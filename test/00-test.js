var request = require('supertest');
var logger    = require('yocto-logger');
var config    = require('yocto-config')(logger);
var server    = require('../src')(config, logger);

logger.enableConsole(false);

describe('Express()', function () {
  var e;
  it ('Config must properly load', function (done) {
    server.config.setConfigPath('./example/config');
    server.config.enableExpress();

    server.configure().then(function (success) {
      server.getApp().get('/', function(req, res){
        res.sendStatus(200).end();
      });

      e = server.getApp().listen(3000);
      done();
    })
  });

  it('responds to /', function (done) {
    request(e)
      .get('/')
      .expect(200, done);
    });

  it('404 everything else', function (done) {
    request(e)
      .get('/foo/bar')
      .expect(404, done);
  });
  
  it ('Must disconnect properly', function (done) {
    e.close();
    done();
    process.exit(0);
  });
});