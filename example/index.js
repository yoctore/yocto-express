var logger    = require('yocto-logger');
var config    = require('yocto-config')(logger);

var e         = require('../dist')(config, logger);
var util      = require('util');


//e.config.set('base', './example/config');
e.config.setConfigPath('./example/config');
e.config.enableExpress();

e.useDirectory('publiceeeeAA');
e.useDirectory('publiceeeeAA', '/toto');
e.configure().then(function (success) {
  console.log(success);
  console.log('session =>', e.getApp().get('session'));
}).catch(function (error) {
  console.log(error);
});