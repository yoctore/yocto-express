'use strict';

var df            = require('dateformat');
var uuid          = require('uuid');
var _             = require('lodash');
var logger        = require('yocto-logger');
var express       = require('express');
var compression   = require('compression');
var fs            = require('fs');
var path          = require('path');
var consolidate   = require('consolidate');
var favicon       = require('serve-favicon');
var cookieParser  = require('cookie-parser');
var bodyParser    = require('body-parser');
var utils         = require('yocto-utils');
var session       = require('express-session');
var multipart     = require('connect-multiparty');
var lusca         = require('lusca');
var Q             = require('q');
var MongoStore    = require('connect-mongo')(session);
var prerender     = require('prerender-node');
var cors          = require('cors');
var https         = require('https');
var joi           = require('joi');
var url           = require('url');
var async         = require('async');
var yoctoJwt      = require('yocto-jwt');
var fs            = require('fs-extra');
var config        = require('yocto-config');

/**
 * Manage Express setup from given configuration
 *
 * @author ROBERT Mathieu <mathieu@yocto.re>
 *
 * @class Express
 * @param {Instance} config yocto-config instance to use
 * @param {Instance} logger yocto-logger instance to use
 */
function Express (config, logger) {
  /**
   * Default app name const
   *
   * @public
   * @memberof Express
   * @member {String} DEFAULT_APP_NAME
   */
  this.DEFAULT_APP_NAME = [ 'app-#', uuid.v4(), '-', df(new Date(), 'yyyymd') ].join('');

  /**
   * Default app instance
   *
   * @public
   * @memberof Express
   * @member {Object} app
   */
  this.app              = express();

  /**
   * Default logger instance
   *
   * @public
   * @memberof Express
   * @member {Object} logger
   */
  this.logger           = logger;

  /**
   * Default config instance
   *
   * @public
   * @memberof Express
   * @member {Object} config
   */
  this.config           = config;

  /**
   * Default property state
   *
   * @public
   * @memberof Express
   * @member {Boolean} state
   * @default false
   */
  this.state            = false;
}

/**
 * Get settings of express app
 *
 * @return {Object} settings object or empty object
 */
Express.prototype.getSettings = function () {
  // return object data
  return this.app.settings || {};
};

/**
 * Utiltity method to retrieve current app
 *
 * @return {Object} current express object
 */
Express.prototype.getApp = function () {
  // return current app instance
  return this.app;
};

/**
 * Default process to set default base process
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processBase = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error('[ Express.processBase ] - Cannot process config. App is not ready.');
    // invalid statement
    return false;
  }

  // check some property
  if (_.has(this.config.get('config'), 'app') &&
      _.has(this.config.get('config'), 'env') &&
      _.has(this.config.get('config'), 'host') &&
      _.has(this.config.get('config'), 'protocol')) {

    // set the default name
    this.app.set('app_name', _.words(this.config.get('config').app.name.toLowerCase()).join('-'));
    // log message
    this.logger.info([ '[ Express.processBase ] - Setting app name to [',
                       this.app.get('app_name'), ']'
                     ].join(' '));

    // setting up env
    this.app.set('env', this.config.get('config').env);
    // log message
    this.logger.info([ '[ Express.processBase ] - Setting env to [',
                        this.app.get('env'), ']'
                     ].join(' '));

    // setting up host
    this.app.set('host', this.config.get('config').host);
    // log message
    this.logger.info([ '[ Express.processBase ] - Setting host to [',
                       this.app.get('host'), ']'
                     ].join(' '));

    // setting up protocol
    this.app.set('protocol', this.config.get('config').protocol.type || 'http');
    // log message
    this.logger.info([ '[ Express.processBase ] - Setting protocol to [',
                       this.app.get('protocol'), ']'
                     ].join(' '));

    var port = this.config.get('config').protocol.port || 3000;

    // setting port
    this.app.set('port', port);

    // log message
    this.logger.info([ '[ Express.processBase ] - Setting port to [',
                       port, ']'
                     ].join(' '));

    // is https ?
    if (this.app.get('protocol') === 'https') {
      // get path of cert & key file
      var keyPath   = this.config.get('config').protocol.certificate.key;
      var certPath  = this.config.get('config').protocol.certificate.cert;

      // normalize keyPath and cert Path
      keyPath   = !path.isAbsolute(keyPath)  ? path.normalize([ process.cwd(), keyPath ].join('/'))
                                             : keyPath;
      certPath  = !path.isAbsolute(certPath) ? path.normalize([ process.cwd(), certPath ].join('/'))
                                             : certPath;

      // generate credidentials
      var privateKey  = fs.readFileSync(keyPath, 'utf8');
      var certificate = fs.readFileSync(certPath, 'utf8');
      // build credentials object for server
      var credentials = { key : privateKey, cert : certificate };

      // add override listen method to lisen to https
      this.app.listen = function () {
        // create server
        var server = https.createServer(credentials, this);
        // return new server with data
        return server.listen.apply(server, arguments);
      }.bind(this.app);
    }

    // valid statement
    return true;
  }

  // invalid statement
  return false;
};

/**
 * Enable stack error
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processStackError = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processStackError ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  //  getting data
  var state = this.config.get('config').app.stackError || true;

  // setting up stack error
  this.app.set('showStackError', state);

  // log state message
  this.logger.info([ '[ Express.enableStackError ] -',
                     (state ? 'Enabling' : 'Disabling'), 'showStackError' ].join(' '));

  // default statement
  return true;
};

/**
 * Enable / Disable pretty HTML output
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processPrettyHTML = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processPrettyHTML ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // Checking data
  var state = this.config.get('config').express.prettyHTML || true;

  // set value
  this.app.locals.pretty = state;
  // log state message
  this.logger.info([ '[ Express.processPrettyHTML] -',
                     (state ? 'Enabling' : 'Disabling'), 'pretty HTML' ].join(' '));

  // default statement
  return true;
};

/**
 * Process view engine setting
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processViewEngine = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processViewEngine ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // current engine name
  var name = this.config.get('config').express.viewEngine || 'jade';

  // adding consolidatejs
  this.app.engine(name, consolidate[name]);

  // change view engine
  this.app.set('view engine', name);
  // log message
  this.logger.info([ '[ Express.processViewEngine ] - Setting view engine to [',
                     this.app.get('view engine'), ']' ].join(' '));

  // default statement
  return true;
};

/**
 * Process directory path to use on app
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processDirectory = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processDirectory ] -',
                        'Cannot process config. App is not ready.' ].join(''));
    // invalid statement
    return false;
  }

  // default directory list
  var directories = this.config.get('config').directory;

  // reading config file
  _.each(directories, function (d) {
    // process
    this.useDirectory(_.first(Object.keys(d)));
  }.bind(this));

  // default statement
  return true;
};

/**
 * Setting up favicon
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processFavicon = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processFavicon ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // default path
  var p = this.config.ICONS_DIRECTORY;

  // is relative path ?
  if (!path.isAbsolute(p)) {
    // normalize path
    p = path.normalize([ process.cwd(), p ].join('/'));
  }

  // build path
  var fav = [ p, 'favicon.ico' ].join('/');

  // file exists ?
  if (fs.existsSync(fav)) {
    // set and log
    this.logger.info([ '[ Express.useFavicon ] - Adding favicon : ', fav ].join(' '));
    // use
    this.app.use(favicon(fav,  { maxAge : 2592000000 }));
  } else {
    // error
    this.logger.warning([ '[ Express.useFavicon ] - Favicon doesn\'t exist.',
                          'Checking path [', fav, '] failed' ].join(' '));
  }

  // default statement
  return true;
};

/**
 * Process default compression
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processCompression = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processCompression ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // Getting express config
  var eConfig = this.config.get('config').express;

  // Setting up filter for express compression
  if (!(_.isUndefined(eConfig.filter))) {

    // getting filter
    var eFilter = eConfig.filter || {};

    // testing rules
    if ((_.isString(eFilter.rules)) && (_.isString(eFilter.by)) && (_.isNumber(eFilter.level))) {

      // processsing
      this.logger.info([ '[ Express.processCompression ] -',
                         'Setting up compression rules with filter [',
                         eFilter.rules, '] for [', eFilter.by, '] at level [',
                         _.parseInt(eFilter.level), ']'
                       ].join(' '));
      // set up
      this.app.use(compression({
        filter  : function (request, response) {
          // has header with no compression rules ?
          if (_.has(request, 'headers') && request.headers['x-no-compression']) {
            return false;
          }

          // main compression process
          var rules = new RegExp(eFilter.rules);
          // return tests
          return rules.test(response.getHeader(eFilter.by));
        },
        level   : _.parseInt(eFilter.level)
      }));
    }
  }

  // default statement
  return true;
};

/**
 * Process jsoncallback state
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processJsonCallack = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processJsonCallack ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get config
  var state = this.config.get('config').express.jsonp;

  // log specific message
  this.logger[ (state ? 'info' : 'warning') ]([ '[ Express.processJsonCallack ] -',
                                                (state ? 'Enable' : 'Disable'),
                                                'JSONP for express' ] .join(' '));

  // process
  this.app.enable('jsonp callback', state);

  // default statement
  return true;
};

/**
 * Process CookieParser state
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processCookieParser = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processCookieParser ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get config
  var parser = this.config.get('config').express.cookieParser;

  // log specific message
  this.logger[ (parser.enable ? 'info' : 'warning') ]([ '[ Express.processCookieParser ] -',
                                                        (parser.enable ? 'Enable' : 'Disable'),
                                                        'cookieParser' ] .join(' '));

  // process
  if (parser.enable) {
    this.app.use(cookieParser(parser.secret, parser.options));
  }

  // default statement
  return true;
};

/**
 * Process BodyParser configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processBodyParser = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processBodyParser ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // for the moment allow only this
  var rules = [ 'json', 'urlencoded' ];

  // parse rules
  _.each(rules, function (rule) {
    // get current
    var r = this.config.get('config').express[rule];

    // logging message
    this.logger.info([ '[ Express.configure.processBodyParser ] - Setting up [', rule,
                       '] parser' ].join(' '));
    this.logger.debug([ '[ Express.configure.processBodyParser ] - Used params for [', rule,
                        '] config are :', utils.obj.inspect(r) ].join(' '));

    // setting up body parser
    this.app.use(bodyParser[rule](r));
  }.bind(this));

  // default statement
  return true;
};

/**
 * Process methodOverride configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processMethodOverride = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processMethodOverride ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get all methods
  var methods = this.config.get('config').express.methodOverride;

  // parse available methods
  _.each(methods, function (method) {
    this.logger.info([ '[ Express.processMethodOverride ] - Setting up methodOverride to use [',
                       method, '] header rules' ].join(' '));
  }.bind(this));

  // default statement
  return true;
};

/**
 * process processSession configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processSession = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processSession ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get session data
  var s = this.config.get('config').express.session;

  // session is enable ?
  if (s.enable) {

    // need uuid generator ?
    if (s.options.genuuid) {

      // gen function
      var gen = function () {
        return uuid.v4();
      };

      // remove state flag non needed on session middleware options
      delete s.options.genuuid;

      // extend options with new genid function
      _.extend(s.options, { genid : gen });
    }
  }

  // trust proxy ?
  if (s.options.proxy) {
    this.logger.info('[ Express.processSession ] - Enable proxy trust for current express app');
    // trust proxy
    this.app.set('trust proxy', 1);
  }

  // save it
  var opStore = _.clone(s.options.store);
  // remove it specific process
  delete s.options.store;

  // has store rules ?
  if (!_.isUndefined(opStore)) {
    // set defaults instance and type
    var instance  = opStore.instance || 'mongo';
    var type      = opStore.type || 'uri';

    // is uri ? and is String ? ant not empty ?
    if (instance === 'mongo' && type === 'uri' &&
        _.isString(opStore.uri) && !_.isEmpty(opStore.uri)) {

      // check if property sslCA exist
      if (_.has(opStore.options, 'server.sslCA') && _.isString(opStore.options.server.sslCA)) {
        // create buffer of this file
        opStore.options.server.sslCA = [
          fs.readFileSync(path.normalize(process.cwd() + '/' + opStore.options.server.sslCA))
        ];
      }

      // check if property sslKey exist
      if (_.has(opStore.options, 'server.sslKey') && _.isString(opStore.options.server.sslKey)) {

        // create buffer of this file
        opStore.options.server.sslKey =
          fs.readFileSync(path.normalize(process.cwd()  + '/' + opStore.options.server.sslKey));
      }

      // check if property sslCert exist
      if (_.has(opStore.options, 'server.sslCert') && _.isString(opStore.options.server.sslCert)) {
        // create buffer of this file
        opStore.options.server.sslCert =
          fs.readFileSync(path.normalize(process.cwd()  + '/' + opStore.options.server.sslCert));
      }

      // set store data
      _.extend(s.options, {
        store : new MongoStore({
          url           : opStore.uri,
          mongoOptions  : opStore.options || {}
        })
      });
    } else {
      // warning another type than uri
      // BUT : we need to implement it
      this.logger.warning([ '[ Express.processSession ] -',
                            'Session storage rules given is not an uri type.',
                            'Need to implement', type, 'process' ].join(' '));
    }
  }

  // log message
  this.logger.info([ '[ Express.processSession ] -',
                     'Setting up expression session middleware support for current express app'
                   ].join(' '));
  this.logger.debug([ '[ Express.processSession ] -',
                      'Config data used for session setting are : ',
                      utils.obj.inspect(s.options)
                    ].join(' '));
  // default session
  var sessionInstance = session(s.options);
  // process assignement
  this.app.use(sessionInstance);
  // expose session on app for some case of usage
  this.app.set('session', sessionInstance);

  // default statement
  return true;
};

/**
 * process processMultipart configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processMultipart = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processMultipart ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get multipart state
  var m = this.config.get('config').express.multipart;

  // enable multiplart ?
  if (m) {
    // log
    this.logger.info([ '[ Express.processMultipart ] -',
                       'Setting up multipart support for current express app' ].join(' '));
    // setting up multipart
    this.app.use(multipart());
  }

  // default statement
  return true;
};

/**
 * process security configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processSecurity = function () {

  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processSecurity ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get security data
  var security = this.config.get('config').express.security;

  // security is enable ?
  if (security.enable) {
    // parse all object keys
    _.each(Object.keys(_.omit(security, [ 'enable' ])), function (rule) {
      // use rules ?
      if (!_.isEmpty(rule) && rule !== 'csrf') {

        // log message
        this.logger.info([ '[ Express.processSecurity ] - Setting up [', rule.toUpperCase(),
                           '] rules for current express app' ].join(' '));
        this.logger.debug([ '[ Express.processSecurity ] - Config data used for',
                            rule.toUpperCase(),
                            'setting are : ', utils.obj.inspect(security[rule]) ].join(' '));

        if (rule !== 'nosniff') {
          // process
          this.app.use(lusca[rule](security[rule]));
        } else {
          // enable without param
          if (_.isBoolean(security[rule])) {
            // enable with default construct
            this.app.use(lusca[rule]());
          }
        }
      }
    }.bind(this));
  }

  // default statement
  return true;
};

/**
 * process Seo Rendering configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processPrerender = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processPrerender ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get security data
  var pr      = this.config.get('config').prerender;
  var ready   = false;

  // is defined ?
  if (!_.isUndefined(pr)) {
    // process change host before
    prerender.set('beforeRender', function (req, done) {
      // get host from request
      var host = utils.request.getHost(req);
      // is valid host
      if (_.isString(host)) {
        // replace host protocol
        host = host.replace('http://', '');
        // change headers host
        req.headers.host = host;
      }
      // done do next
      done();
    });

    // has token ?
    if (_.has(pr, 'prerenderToken')) {
      // yes so set
      prerender.set('prerenderToken', pr.prerenderToken);
      // message
      this.logger.debug([ '[ Express.processPrerender ] - Add token :',
                        pr.prerenderToken,
                        'for prerender service' ].join(' '));
      // for change state
      ready = true;
    }

    // has serviceUrl  ?
    if (_.has(pr, 'prerenderServiceUrl')) {
      // yes so set url
      prerender.set('prerenderServiceUrl', pr.prerenderServiceUrl);
      // message
      this.logger.debug([ '[ Express.processPrerender ] - Add service url :',
                        pr.prerenderServiceUrl,
                        'for prerender service' ].join(' '));
      // for change state
      ready = true;
    }

    // has serviceUrl ?
    if (_.has(pr, 'blacklisted')) {
      // yes add blacklisted
      prerender.blacklisted(pr.blacklisted);
      // message
      this.logger.debug([ '[ Express.processPrerender ] - Add blacklist rules :',
                        utils.obj.inspect(pr.blacklisted),
                        'for prerender service' ].join(' '));
    }

    // has serviceUrl ?
    if (_.has(pr, 'additionalAgents')) {
      // yes add
      _.each(pr.additionalAgents, function (agent) {
        prerender.crawlerUserAgents.push(agent);
      });
    }

    // is ready to set ?
    if (ready) {
      // Here before it's look like that we need to process a before render but is local
      // installation case it looks like that we dont need this so we decide to
      // delete it and use a specific seo render program
      // nothing to do but is seo process so build a message
      this.logger.info('[ Express.processPrerender ] - Setting up on express.');
      // use prerender
      this.app.use(prerender);
    } else {
      // warning message have data but not all
      this.logger.warning([ '[ Express.processPrerender ] -',
                            'Setup failed. token or service url is missing' ].join(' '));
      // is here an error occured
      return false;
    }
  } else {
    // nothing to do but is seo process so build a message
    this.logger.info('[ Express.processPrerender ] - nothing to process prerender is disabled.');
  }

  // default statement
  return true;
};

/**
 * Process JWT token process for express
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processJwt = function () {
  // create async process
  var deferred = Q.defer();
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processJwt ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    deferred.reject();
  }

  // get security data
  var jwtoken   = this.config.get('config').jwt;
  // required jwt here for custom logger
  var jwt       = yoctoJwt(this.logger);

  // all is ok ?
  if (_.isBoolean(jwtoken.enable) && jwtoken.enable &&
      _.isString(jwtoken.key) && !_.isEmpty(jwtoken.key)) {
    // debug message
    this.logger.debug('[ Express.processJwt ] - Try to process jwt key');
    // set current algorithm
    jwt.algorithm(jwtoken.algorithm || 'HS256');

    // load item
    jwt.load().then(function () {
      // add alowed ips
      jwt.allowedIps(jwtoken.ips || []);
      // add alowed routes
      jwt.addAllowedRoutes(jwtoken.allowedRoutes || []);

      // set key
      if (jwt.setKey(jwtoken.key)) {
        // add autorize middleware for automatic check
        this.app.use(jwt.isAuthorized());
        // messsage
        this.logger.info('[ Express.processJwt ] - Check json request autorization enabled.');
        // check if middleware should be set
        if (jwtoken.autoEncryptRequest) {
          // enable auto encrypt json request
          this.app.use(jwt.autoEncryptRequest());
          // messsage
          this.logger.info('[ Express.processJwt ] - Auto encrypt json response enabled.');
        }
        // check if middleware should be set
        if (jwtoken.autoDecryptRequest) {
          // enable auto decrypt json request
          this.app.use(jwt.autoDecryptRequest());
          // messsage
          this.logger.info('[ Express.processJwt ] - Auto decrypt json request enabled.');
        }
        // expose jwt on app
        this.app.set('jwt', jwt);
        // resolve and continue
        deferred.resolve();
      }
    }.bind(this)).catch(function (error) {
      // log error message
      this.logger.error(error);
      // reject
      deferred.reject(error);
    }.bind(this));
  } else {
    // message
    this.logger.info('[ Express.processJwt ] - Nothing to process. jwt is disabled.');
    // resolve and continue
    deferred.resolve();
  }

  // default statement
  return deferred.promise;
};

/**
 * Process CORS process for express
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processCors = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processCors ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get security data
  var enableCors      = this.config.get('config').cors;
  // cors config
  var corsConfig      = this.config.get('config').corsCfg;
  // all is ok ?
  if (_.isBoolean(enableCors) && enableCors) {
    // debug message
    this.logger.debug('[ Express.processCors ] - Try to enable CORS on app.');

    // has config ?
    if (_.isObject(corsConfig) && !_.isEmpty(corsConfig)) {
      // debug message
      this.logger.debug([ '[ Express.processCors ] - CORS is enabled with a custom config :',
        utils.obj.inspect(corsConfig) ].join(' '));
      // add cors with config
      this.app.use(cors(corsConfig));
    } else {
      // add cors
      this.app.use(cors());
    }
    // message
    this.logger.info('[ Express.processCors ] - CORS is enable for all routes.');
  } else {
    // message
    this.logger.info('[ Express.processCors ] - Nothing to process. CORS is disabled.');
  }

  // default statement
  return true;
};

/**
 * Enable redirect rules for current application defined on config file
 */
Express.prototype.processRedirect = function () {
  // config is ready ?
  if (!this.isReady()) {
    // error message
    this.logger.error([ '[ Express.processRedirect ] -',
                        'Cannot process config. App is not ready.' ].join(' '));
    // invalid statement
    return false;
  }

  // get redirect data
  var redirect = this.config.get('config').redirect;
  // disable www redirect
  if (redirect) {
    // log message
    this.logger.info('[ Express.processRedirect ] - redirect rules are defined, processs it ...');
    // has redirect ?
    if (redirect.www) {
      // log message
      this.logger.info('[ Express.processRedirect ] - Enable 301 www redirection ...');
      // set it
      this.app.use(function (req, res, next) {
        // get current host
        var host = utils.request.getHost(req);
        // check it
        if (!_.startsWith(host, 'www.')) {
          // default redirect
          return res.redirect(301, [ req.protocol, '://www.', host, req.originalUrl ].join(''));
        }
        // do next process
        next();
      });
    }
    // is on request list
    if (_.has(redirect, 'seo') && _.isArray(redirect.seo) && !_.isEmpty(redirect.seo)) {
      // log message
      this.logger.info('[ Express.processRedirect ] - enable redirect for custom url');
      // set it
      this.app.use(function (req, res, next) {
        // get current host
        var host = utils.request.getHost(req);

        // validation schema
        var schema = joi.object().required().keys({
          code          : joi.number().required().valid([ 301, 302 ]),
          fromUrl       : joi.string().required().empty(),
          toUrl         : joi.string().required().empty(),
          queryString   : joi.boolean().optional().default(false)
        });

        // get correct url
        var obj = _.find(redirect.seo, function (item) {
          // default statement
          return item.fromUrl === req.originalUrl;
        });

        // item was founded ?
        if (!_.isUndefined(obj)) {
          // schema validation
          var validate = joi.validate(obj, schema);

          // has no error ?
          if (_.isNull(validate.error)) {

            // has query string ?
            var qse = url.parse(validate.value.fromUrl);

            // default endUrl
            var endUrl = [ req.protocol, '://', host, validate.value.toUrl ].join('');

            // is absolute url ?
            if (_.startsWith(validate.value.toUrl, 'http') ||
              _.startsWith(validate.value.toUrl, 'https')) {
              // change endUrl to use full defined url
              endUrl = validate.value.toUrl;
            }

            // add original query string to desitnation url ?
            if (validate.value.queryString && !_.isNull(qse.query)) {
              // destination url as sub routes ?
              var qsee = url.parse(endUrl);
              // path is already defined and href url not ending by a slash ?
              if (_.isNull(qsee.path) && !_.endsWith(qsee.href, '/')) {
                // add slash at the end for query process
                endUrl = [ endUrl , '/' ].join('');
              }
              // build with extract query string
              endUrl = [ endUrl, qse.query ].join('?');
            }
            // default redirect statement
            return res.redirect(validate.value.code, endUrl);
          }
        }
        // do next process
        next();
      });
    }
  }

  // default statement
  return true;
};

/**
 * Get current state of config load
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.isReady = function () {
  // default statement
  return this.state && this.config.state;
};

/**
 * Defaut method to process initialize without config loading.
 *
 * @param {Object} data to use
 * @param {Boolean} isConfigInstance if is set to true this.config must be replace by data
 */
Express.prototype.configureWithoutLoad = function (data, isConfigInstance) {
  // create async process
  var deferred  = Q.defer();

  // normalize a config instance
  isConfigInstance = _.isBoolean(isConfigInstance) ? isConfigInstance : false;

  // if is a config instance
  if (isConfigInstance) {
    // force rewrite config
    this.config = data;
    // state must to true
    this.state  = true;
  }

  // define here all call method to process in parallel
  var methods = [
    { name : 'processBase', exception : 'Express base initialisation failed.', banner : false },
    { name : 'processStackError', exception : 'Stack error setup failed.', banner : false },
    { name : 'processPrettyHTML', exception : 'Pretty HTTML setup failed.', banner : false },
    { name : 'processViewEngine', exception : 'View engine setup failed.', banner : false },
    { name : 'processCompression', exception : 'Compression setup failed', banner : false },
    { name : 'processDirectory', exception : 'Directory setup failed.', banner : false },
    { name : 'processFavicon', exception : 'Favicon setup failed.', banner : false },
    { name : 'processJsonCallack', exception : 'JsonCallback setup failed.', banner : false },
    { name : 'processCookieParser', exception : 'CookieParser setup failed.', banner : false },
    { name : 'processBodyParser', exception : 'BodyParser setup failed.', banner : false },
    { name : 'processMethodOverride', exception : 'MethodOverride setup failed.', banner : false },
    { name : 'processSession', exception : 'Session setup failed.', banner : false },
    { name : 'processMultipart', exception : 'Multipart setup failed.', banner : false },
    { name : 'processRedirect', exception : 'Redirect setup failed.', banner : false },
    { name : '', exception : 'Processing security rules', banner : true },
    { name : 'processSecurity', exception : 'Security setup failed.', banner : false },
    { name : 'processCors', exception : 'Cors setup failed.', banner : false },
    { name : '', exception : 'Setting up Seo renderer system', banner : true },
    { name : 'processPrerender', exception : 'Prerender setup failed.', banner : false },
    { name : '', exception : 'Setting up Jwt crypt/decrypt', banner : true }
  ];

  // error storage
  var errors = [ ];

  // parse all methods
  async.each(methods, function (method, next) {
    // is valid item ?
    if (!method.banner && !_.isEmpty(method.name)) {
      // call succeed ?
      if (!(this[method.name].call(this))) {
        // push exception message in errors storage
        errors.push(method.exception);
      }
    } else {
      // log message
      this.logger.banner([ '[ Express.configure ] - Initializing Express >',
        method.exception, '...' ].join(' '));
    }
    // go to next item
    next();
  }.bind(this), function () {
    // has errors ?
    if (!_.isEmpty(errors)) {
      // log errors
      this.logger.error([ '[ Express.configure ] - Initializing Express Failed. Errors occured :\n',
         _.map(errors, function (error) {
            return [ _.repeat('\t', 4),' |--->', error, '\n' ].join(' ');
          }).join('') ].join(' '));
      // reject
      deferred.reject(errors);
    } else {
      // process jwt
      // setup jwt
      this.processJwt().then(function () {
        // Setting up router
        this.logger.banner('[ Express.configure ] - Setting up Router for current express app');
        // enable express router
        this.app.use(express.Router());

        // ok message
        this.logger.info('[ Express.configure ] - Express is ready to use ....');
        // all is okay so resolve
        deferred.resolve(this.app);
      }.bind(this)).catch(function (error) {
        // reject
        deferred.reject([ 'Jwt setup failed.', error ].join(' '));
      });
    }
  }.bind(this));

  // default statement
  return deferred.promise;
};

/**
 * Default configure option
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.configure = function () {
  // create async process
  var deferred  = Q.defer();

  // welcome message ...
  this.logger.banner('[ Express.configure ] - Initializing Express ...');

  // main process
  this.config.load().then(function (success) {

    // state is success
    this.state = _.isObject(success) && !_.isEmpty(success);

    // process without load
    this.configureWithoutLoad(success).then(function (wdata) {
      // resolve
      deferred.resolve(wdata);
    }).catch(function (werror) {
      // reject
      deferred.reject(werror);
    });
  }.bind(this)).catch(function (error) {
    // error message
    this.logger.error('Invalid config given. Please check your config files');
    // reject with error
    deferred.reject(error);
  }.bind(this));

  // default statement
  return deferred.promise;
};

/**
 * Set directory to use on express app
 *
 * @param {String} name name of path for bind from config file
 * @param {String} p path to use if we need to force the current path manually
 * @return {Boolean} true if success false otherwise
 */
Express.prototype.useDirectory = function (name, p) {
  // checking name
  if (_.isString(name) && !_.isEmpty(name)) {
    // default path
    p = _.isString(p) &&
       !_.isEmpty(p) ? p : (this.config[ [ name, 'DIRECTORY' ].join('_').toUpperCase() ] || name);

    // is relative path ?
    if (!path.isAbsolute(p)) {
      // normalize path
      p = path.normalize([ process.cwd(), p ].join('/'));
    }

    // directory exist ?
    if (fs.existsSync(p)) {

      // adding ? log it
      this.logger.info([ '[ Express.useDirectory ] - Adding directory', p,
                         'on express app' ].join(' '));

      if (name !== 'views') {
        // set static directory
        this.app.use(express.static(p, this.config.get('config').express.staticServe));
      } else {
        // set views
        this.app.set(name, p);
      }

      // return success statement
      return true;
    }

    // log message
    this.logger.warning([ '[ Express.useDirectory ] - Cannot add directory', name,
                          'on express app. Directory [', p, '] does not exist' ].join(' '));
  }

  // return failed statement
  return false;
};

/**
 * Removing middleware form key name
 *
 * @param {String} name name of middleware to remove
 * @return {Array} list of middleware
 */
Express.prototype.removeMiddleware = function (name) {

  // default state
  var state = false;

  // parse router stack
  var middlewareIndex = _.findIndex(this.app._router.stack, 'name', name);

  // if correct index ?
  if (middlewareIndex >= 0) {
    // remove item on stack
    this.app._router.stack.splice(middlewareIndex, 1);

    // change state
    state = true;
  }

  // log
  this.logger[ (state ? 'info' : 'warning') ]([ '[ Express.removeMiddleware ] -',
                                                'removing middleware', name,
                                                (state ? 'success' :
                                                'failed. Middleware does not exist') ].join(' '));

  // return state
  return state;
};

/**
 * get set function, assign given data to a property
 *
 * @param {String} name name of property
 * @param {Mixed} value value of property
 * @return {Object} current instance
 */
Express.prototype.set = function (name, value) {
  // check requirements
  if (!_.isUndefined(name) && _.isString(name) && !_.isEmpty(name)) {
    // assign value
    this[name] = value;
  } else {
    // log a warning messsage.
    this.logger.warning([ '[ Express.set ] - Invalid value given.',
                          'name must be a string and not empty. Operation aborted !' ].join(' '));
  }

  // returning current instance
  return this;
};

// Default export
module.exports = function (c, l) {
  // is a valid logger ?
  if (_.isUndefined(l) || _.isNull(l)) {
    logger.warning('[ Express.constructor ] - Invalid logger given. Use internal logger');
    // assign
    l = logger;
  }

  // is a valid config ?
  if (_.isUndefined(c) || _.isNull(c)) {
    logger.warning('[ Express.constructor ] - Invalid config given. Use internal config');
    // assign
    c = config(l);
    // auto enableExpress
    c.enableExpress();
  }

  // default statement
  return new (Express)(c, l);
};
