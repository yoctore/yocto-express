var logger    = require('yocto-logger');
var config    = require('yocto-config')(logger);

var e         = require('../src')(config, logger);
var util      = require('util');


//e.config.set('base', './example/config');



e.useDirectory('publiceeeeAA');
e.useDirectory('publiceeeeAA', '/toto');
e.configure().then(function (success) {
  console.log(success);
}).catch(function (error) {
  console.log(error);
});