"use strict";

var _ = require('lodash');

var beans = require('nconf').get('beans');
var misc = beans.get('misc');

var Resource = beans.get('resource');

//var util = require('util');

var removeInvalidResources = function (state) {
  _.each(Object.getOwnPropertyNames(state), function (key) {
    if (!state[key]) {
      delete state[key];
    }
  });
};

function Resources(state) {
  this.state = state; // this must be *the* object that is referenced by activity.resources
  removeInvalidResources(this.state);
}

Resources.prototype.resourceNames = function () {
  var self = this;
  return _(Object.getOwnPropertyNames(self.state))
    .map(function (key) { return { name: key, position: self.state[key]._position }; })
    .sortBy(function (entry) { return entry.position; })
    .pluck("name").value();
};

Resources.prototype.named = function (resourceName) {
  return new Resource(this.state[resourceName], resourceName);
};

Resources.prototype.copyFrom = function (originalResources) {
  var self = this;
  _.each(originalResources.resourceNames(), function (resourceName) {
    self.state[resourceName] = {};
    self.named(resourceName).copyFrom(originalResources.named(resourceName));
  });
  return self;
};

Resources.prototype.fillFromUI = function (uiInputArrays) {
  function matchArrayEntries(input) {
    return _.zip(misc.toArray(input.previousNames), misc.toArray(input.names), misc.toArray(input.limits),
      misc.toArray(input.isRegistrationOpen), misc.toArray(input.hasWaitinglist));
  }

  var newResources = matchArrayEntries(uiInputArrays);
  var self = this;
  var newState = {};
  var position = 1;

  _.each(newResources, function (input) {

    var previousName = input[0];
    var name = input[1];

    // store it under the new name
    if (name) {
      // get the old resource or create a new resource
      var resource = self.named(previousName);
      resource.fillFromUI({limit: input[2], isRegistrationOpen: input[3], hasWaitinglist: input[4], position: position++});
      newState[name] = resource.state;
    }
  });

  // empty the old state (but do not alter the state object because it belongs to the surrounding activity!)
  _.each(self.resourceNames(), function (resourceName) {
    delete self.state[resourceName];
  });

  // transfer the contents of the new state
  _.each(Object.keys(newState), function (newName) {
    self.state[newName] = newState[newName];
  });
};

Resources.prototype.allRegisteredMembers = function () {
  var allMemberIds = [];
  for (var key in this.state) {
    allMemberIds = allMemberIds.concat(this.named(key).registeredMembers());
  }
  return _.uniq(allMemberIds);
};

Resources.prototype.allWaitinglistEntries = function () {
  var allWaitinglistEntries = [];
  for (var key in this.state) {
    allWaitinglistEntries = allWaitinglistEntries.concat(this.named(key).waitinglistEntries());
  }
  return _.chain(allWaitinglistEntries).uniq().compact().value();
};

module.exports = Resources;
