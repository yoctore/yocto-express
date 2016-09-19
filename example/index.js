var logger    = require('yocto-logger');
var config    = require('yocto-config')(logger);

var e         = require('../src')(config, logger);
var util      = require('util');


//e.config.set('base', './example/config');
e.config.setConfigPath('./example/config');
e.config.enableExpress();

e.useDirectory('publiceeeeAA');
e.useDirectory('publiceeeeAA', '/toto');
e.configure().then(function (success) {
 console.log(e.getApp());
 /*e.getApp().use(function(req, res) {
  res.send(200);
 });*/
e.getApp().get('/', function(req, res){
  res.send('hello world');
});

e.getApp().get('/test2', function(req, res){
  res.send('hello world 2');
});

e.getApp().get('/test4', function(req, res){
  res.send('hello world 4');
});

 e.getApp().listen(3000);
  //console.log(success);
  //console.log('session =>', e.getApp().get('session'));
}).catch(function (error) {
  console.log(error);
});