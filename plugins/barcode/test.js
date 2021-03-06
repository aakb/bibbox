/**
 * @file
 * Helper to setup usb barcode on new machines.
 */
'use strict';

var config = require('./../../config.json');

var bus = null;
var b = require('./../bus/bus.js');
b({}, {}, function (a, r) {
  bus = r.bus;
});

var barcode = null;
b = require('./barcode.js');
b({vid: config.barcode.vid, pid: config.barcode.pid}, {bus: bus}, function (a, r) {
  barcode = r.barcode;
});

barcode.on('err', function (err) {
  console.log(err);
});

var stop = false;
barcode.on('code', function (data) {
  console.log('Barcode: ' + data);
  stop = true;
});
barcode.start();

process.on('SIGINT', function () {
  stop = true;
});

(function wait () {
  if (!stop) {
    setTimeout(wait, 100);
  }
})();
