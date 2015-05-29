var e         = require('../src');
var util      = require('util');
var logger    =  require('yocto-logger');


e.config.set('base', './example/config');

e.useDirectory('publiceeeeAA');
e.useDirectory('publiceeeeAA', '/toto');
if (!e.configure()) {
  logger.error('Cannot process express. some errors occured. fix it before run');
} else {
  logger.info(util.inspect(e, { depth : null }));  
}
