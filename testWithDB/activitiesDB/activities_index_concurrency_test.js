"use strict";

var request = require('supertest');
var sinon = require('sinon').sandbox.create();
var expect = require('chai').expect;

var conf = require('../configureForTestWithDB');

var beans = conf.get('beans');
var fieldHelpers = beans.get('fieldHelpers');
var activitystore = beans.get('activitystore');
var persistence = beans.get('activitiesPersistence');
var Activity = beans.get('activity');

var createApp = require('../../test/testHelper')('activitiesApp', beans).createApp;

var getActivity = function (url, callback) {
  persistence.getByField({url: url}, function (err, activityState) {
    callback(err, new Activity(activityState));
  });
};


describe('Activity application with DB - on submit -', function () {

  var activityBeforeConcurrentAccess;
  var activityAfterConcurrentAccess;
  var invocation;

  beforeEach(function (done) { // if this fails, you need to start your mongo DB

    activityBeforeConcurrentAccess = new Activity({id: "activityId", title: 'Title of the Activity', description: 'description1', assignedGroup: 'groupname',
      location: 'location1', direction: 'direction1', startUnix: fieldHelpers.parseToUnixUsingDefaultTimezone('01.01.2013'),
      url: 'urlOfTheActivity', owner: 'owner',
      resources: {Veranstaltung: {_registeredMembers: [], _registrationOpen: true }}, version: 1});

    activityAfterConcurrentAccess = new Activity({id: "activityId", title: 'Title of the Activity', description: 'description1', assignedGroup: 'groupname',
      location: 'location1', direction: 'direction1', startUnix: fieldHelpers.parseToUnixUsingDefaultTimezone('01.01.2013'),
      url: 'urlOfTheActivity', owner: 'owner',
      resources: {Veranstaltung: {_registeredMembers: [
        {memberId: 'memberId1'}
      ], _registrationOpen: true }}, version: 2});

    invocation = 1;

    sinon.stub(activitystore, 'getActivity', function (url, callback) {
      // on the first invocation, getActivity returns an activity without registrant to mimick a racing condition.
      if (invocation === 1) {
        invocation = 2;
        return callback(null, activityBeforeConcurrentAccess);
      }
      // on subsequent invocations, getActivity returns an activity with registrant.
      return callback(null, activityAfterConcurrentAccess);
    });


    persistence.drop(function () {
      // save our activity with one registrant
      activitystore.saveActivity(activityAfterConcurrentAccess, function (err) {
        done(err);
      });
    });
  });


  afterEach(function () {
    sinon.restore();
  });

  it('rejects an activity with invalid and different url', function (done) {

    request(createApp('memberId'))
      .post('/submit')
      .send('url=urlOfTheActivity&previousUrl=urlOfTheActivity&location=location2&title=Title 2&startDate=02.07.2000&startTime=19:00&endDate=02.07.2000&endTime=21:00&resources[names]=Veranstaltung')
      .expect(302)
      .expect(/Redirecting to \/activities\/edit\/urlOfTheActivity/, function (err) {
        if (err) { return done(err); }
        // check that activity did not get changed on the database
        getActivity("urlOfTheActivity", function (err, activity) {
          if (err) { return done(err); }
          expect(activity.resourceNamed('Veranstaltung').registeredMembers(), "Registered member is still there").to.contain("memberId1");
          expect(activity.location(), "Old location was not overwritten").to.equal('location1');
          done(err);
        });
      });
  });

});
