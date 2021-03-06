"use strict";

var path = require('path');
var conf = require('nconf');
var beans = conf.get('beans');
var async = require('async');
var _ = require('lodash');

var validation = beans.get('validation');
var Member = beans.get('member');
var Group = beans.get('group');
var api = beans.get('membersAPI');
var groupsAndMembersAPI = beans.get('groupsAndMembersAPI');
var groupsAPI = beans.get('groupsAPI');
var misc = beans.get('misc');
var statusmessage = beans.get('statusmessage');
var notifications = beans.get('notifications');

module.exports = function (app) {
  app.set('views', path.join(__dirname, 'views'));
  app.set('view engine', 'jade');

  function memberForNew(req) {
    return new Member().initFromSessionUser(req.user);
  }

  function saveMember(persistentMember, req, res, next) {
    var member = persistentMember || memberForNew(req);
    var oldEmail = persistentMember ? member.email() : req.body.previousEmail;
    member.addAuthentication(req.body.id);
    member.fillFromUI(req.body);
    api.saveMember(member, function (err) {
      if (err) { return next(err); }
      if (!req.user.member || req.user.member.id() === member.id()) {
        req.user.member = member;
        delete req.user.profile;
      }
      var subscriptions = misc.toArray(req.body.newSubscriptions);
      if (!persistentMember) { // new member
        // must be done here, not in API to avoid circular deps
        notifications.newMemberRegistered(member, subscriptions);
      }
      return groupsAndMembersAPI.updateSubscriptions(member, oldEmail, subscriptions, function (err) {
        if (err) { return next(err); }
        statusmessage.successMessage(req, 'message.title.save_successful', 'message.content.members.saved');
        return res.redirect('/members/' + encodeURIComponent(member.nickname()));
      });
    });
  }

  function memberSubmitted(req, res, next) {
    groupsAndMembersAPI.getUserWithHisGroups(req.body.previousNickname, function (err, member) {
      if (err) { return next(err); }
      saveMember(member, req, res, next);
    });
  }

  app.get('/', function (req, res, next) {
    api.allMembers(function (err, members) {
      if (err) { return next(err); }
      res.render('index', { members: members });
    });
  });

  app.get('/checknickname', function (req, res) {
    var nickname = req.query.nickname;
    var previousNickname = req.query.previousNickname;
    if (previousNickname === nickname) {
      return res.end('true');
    }
    api.isValidNickname(nickname, function (err, result) {
      if (err) { return res.end('false'); }
      res.end(result.toString());
    });
  });

  app.get('/checkemail', function (req, res) {
    var email = req.query.email;
    var previousEmail = req.query.previousEmail;
    if (previousEmail === email) {
      return res.end('true');
    }
    api.isValidEmail(email, function (err, result) {
      if (err) { return res.end('false'); }
      res.end(result.toString());
    });
  });

  app.get('/new', function (req, res, next) {
    if (req.user.member) {
      return res.redirect('/members/');
    }
    async.parallel(
      { allGroups: function (callback) { groupsAPI.getAllAvailableGroups(callback); },
        alle: function (callback) { groupsAPI.getGroup('alle', callback); },
        commercial: function (callback) { groupsAPI.getGroup('commercial', callback); } },
      function (err, results) {
        if (err) { return next(err); }
        var groups = results.allGroups;
        var regionalGroups = groupsAPI.combineSubscribedAndAvailableGroups([results.alle, results.commercial], Group.regionalsFrom(groups));
        var thematicGroups = groupsAPI.combineSubscribedAndAvailableGroups([results.alle, results.commercial], Group.thematicsFrom(groups));
        res.render('edit', { member: memberForNew(req), regionalgroups: regionalGroups, themegroups: thematicGroups});
      });
  });

  app.get('/edit/:nickname', function (req, res, next) {
    var nicknameOfEditMember = req.params.nickname;
    groupsAndMembersAPI.getUserWithHisGroups(nicknameOfEditMember, function (err, member) {
      if (!res.locals.accessrights.canEditMember(member)) {
        return res.redirect('/members/' + encodeURIComponent(member.nickname()));
      }
      if (err || !member) { return next(err); }
      groupsAPI.getAllAvailableGroups(function (err, allGroups) {
        if (err) { return next(err); }
        var regionalGroups = groupsAPI.combineSubscribedAndAvailableGroups(member.subscribedGroups, Group.regionalsFrom(allGroups));
        var thematicGroups = groupsAPI.combineSubscribedAndAvailableGroups(member.subscribedGroups, Group.thematicsFrom(allGroups));
        res.render('edit', { member: member, regionalgroups: regionalGroups, themegroups: thematicGroups});
      });
    });
  });

  app.post('/submit', function (req, res, next) {
    async.parallel([
      function (callback) {
        // we need this helper function (in order to have a closure?!)
        var validityChecker = function (nickname, callback) { api.isValidNickname(nickname, callback); };
        validation.checkValidity(req.body.previousNickname, req.body.nickname, validityChecker, req.i18n.t("validation.nickname_not_available"), callback);
      },
      function (callback) {
        // we need this helper function (in order to have a closure?!)
        var validityChecker = function (email, callback) { api.isValidEmail(email, callback); };
        validation.checkValidity(req.body.previousEmail, req.body.email, validityChecker, req.i18n.t("validation.duplicate_email"), callback);
      },
      function (callback) {
        var errors = validation.isValidForMember(req.body);
        callback(null, errors);
      }
    ],
      function (err, errorMessages) {
        var realErrors = _.filter(_.flatten(errorMessages), function (message) { return !!message; });
        if (realErrors.length === 0) {
          return memberSubmitted(req, res, next);
        }
        return res.render('../../../views/errorPages/validationError', {errors: realErrors});
      }
    );
  });

  app.get('/:nickname', function (req, res, next) {
    var globalCallback = function (err, member, subscribedGroups) {
      if (err || !member) { return next(err); }
      res.render('get', { member: member, subscribedGroups: subscribedGroups });
    };
    groupsAndMembersAPI.getUserWithHisGroups(req.params.nickname, globalCallback);
  });

  return app;
};
