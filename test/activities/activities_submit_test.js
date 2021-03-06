"use strict";

var request = require('supertest');
var sinon = require('sinon').sandbox.create();

var conf = require('../configureForTest');

var beans = conf.get('beans');
var activitiesAPI = beans.get('activitiesAPI');

var createApp = require('../testHelper')('activitiesApp').createApp;

describe('Activity application - on submit -', function () {

  afterEach(function () {
    sinon.restore();
  });

  it('rejects an activity with invalid and different url', function (done) {
    sinon.stub(activitiesAPI, 'isValidUrl', function (isReserved, nickname, callback) { callback(null, false); });

    request(createApp())
      .post('/submit')
      .send('url=uhu&resources[names]=x')
      .send('previousUrl=aha')
      .expect(200)
      .expect(/Validierungsfehler/)
      .expect(/Diese URL ist leider nicht verfügbar./, function (err) {
        done(err);
      });
  });

  it('rejects an activity with empty title', function (done) {
    request(createApp())
      .post('/submit')
      .send('url=uhu&previousUrl=uhu&location=X&startDate=02.07.2000&startTime=19:00&endDate=02.07.2000&endTime=21:00&resources[names]=x')
      .send('title=')
      .expect(200)
      .expect(/Validierungsfehler/)
      .expect(/Titel ist ein Pflichtfeld./, function (err) {
        done(err);
      });
  });

  it('rejects an activity with different but valid url and with empty title', function (done) {
    sinon.stub(activitiesAPI, 'isValidUrl', function (isReserved, nickname, callback) { callback(null, true); });

    request(createApp())
      .post('/submit')
      .send('url=uhu&previousUrl=uhuPrev&location=X&startDate=02.07.2000&startTime=19:00&endDate=02.07.2000&endTime=21:00&resources[names]=x')
      .send('title=')
      .expect(200)
      .expect(/Validierungsfehler/)
      .expect(/Titel ist ein Pflichtfeld./, function (err) {
        done(err);
      });
  });

  it('rejects an activity with two identical resource names', function (done) {
    request(createApp())
      .post('/submit')
      .send('url=uhu&previousUrl=uhu&location=X&title=bla&startDate=02.07.2000&startTime=19:00&endDate=02.07.2000&endTime=21:00')
      .send('resources[names]=Doppelzimmer&resources[names]=Doppelzimmer')
      .expect(200)
      .expect(/Validierungsfehler/)
      .expect(/Die Bezeichnungen der Ressourcen müssen eindeutig sein./, function (err) {
        done(err);
      });
  });

  it('rejects an activity whose resource names are empty', function (done) {
    request(createApp())
      .post('/submit')
      .send('url=uhu&previousUrl=uhu&location=X&title=bla&startDate=02.07.2000&startTime=19:00&endDate=02.07.2000&endTime=21:00')
      .send('resources[names]=&resources[names]=')
      .expect(200)
      .expect(/Validierungsfehler/)
      .expect(/Es muss mindestens eine Ressourcenbezeichnung angegeben werden./, function (err) {
        done(err);
      });
  });

  it('rejects an activity whose resource limits are non-integral', function (done) {
    request(createApp())
      .post('/submit')
      .send('url=uhu&previousUrl=uhu&location=X&title=bla&startDate=02.07.2000&startTime=19:00&endDate=02.07.2000&endTime=21:00&resources[names]=test')
      .send('resources[limits]=&resources[limits]=7,5&resources[limits]=hallo')
      .expect(200)
      .expect(/Validierungsfehler/)
      .expect(/Die Ressourcenbeschränkungen dürfen nur aus Ziffern bestehen./, function (err) {
        done(err);
      });
  });

});