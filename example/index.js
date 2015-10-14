var e         = require('../src')();
var util      = require('util');
var logger    = require('yocto-logger');

e.config.set('base', './example/config');

e.useDirectory('publiceeeeAA');
e.useDirectory('publiceeeeAA', '/toto');
e.configure().then(function (success) {
  console.log(success);
}).catch(function (error) {
  console.log(error);
});