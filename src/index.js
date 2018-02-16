'use strict';

var df            = require('dateformat');
var uuid          = require('uuid');
var _             = require('lodash');
var logger        = require('yocto-logger');
var express       = require('express');
var compression   = require('compression');
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
  this.app = express();

  /**
   * Default logger instance
   *
   * @public
   * @memberof Express
   * @member {Object} logger
   */
  this.logger = logger;

  /**
   * Default config instance
   *
   * @public
   * @memberof Express
   * @member {Object} config
   */
  this.config = config;

  /**
   * Default property state
   *
   * @public
   * @memberof Express
   * @member {Boolean} state
   * @default false
   */
  this.state = false;
}

/**
 * Get settings of express app
 *
 * @return {Object} settings object or empty object
 */
Express.prototype.getSettings = function () {
  // Return object data
  return this.app.settings || {};
};

/**
 * Utiltity method to retrieve current app
 *
 * @return {Object} current express object
 */
Express.prototype.getApp = function () {
  // Return current app instance
  return this.app;
};

/**
 * Default process to set default base process
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processBase = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error('[ Express.processBase ] - Cannot process config. App is not ready.');

    // Invalid statement
    return false;
  }

  // Check some property
  if (_.has(this.config.get('config'), 'app') &&
      _.has(this.config.get('config'), 'env') &&
      _.has(this.config.get('config'), 'host') &&
      _.has(this.config.get('config'), 'protocol')) {
    // Set the default name
    this.app.set('app_name', _.words(this.config.get('config').app.name.toLowerCase()).join('-'));

    // Log message
    this.logger.info([ '[ Express.processBase ] - Setting app name to [',
      this.app.get('app_name'), ']'
    ].join(' '));

    // Setting up env
    this.app.set('env', this.config.get('config').env);

    // Log message
    this.logger.info([ '[ Express.processBase ] - Setting env to [',
      this.app.get('env'), ']'
    ].join(' '));

    // Setting up host
    this.app.set('host', this.config.get('config').host);

    // Log message
    this.logger.info([ '[ Express.processBase ] - Setting host to [',
      this.app.get('host'), ']'
    ].join(' '));

    // Setting up protocol
    this.app.set('protocol', this.config.get('config').protocol.type || 'http');

    // Log message
    this.logger.info([ '[ Express.processBase ] - Setting protocol to [',
      this.app.get('protocol'), ']'
    ].join(' '));

    var port = this.config.get('config').protocol.port || 3000;

    // Setting port
    this.app.set('port', port);

    // Log message
    this.logger.info([ '[ Express.processBase ] - Setting port to [',
      port, ']'
    ].join(' '));

    // Is https ?
    if (this.app.get('protocol') === 'https') {
      // Get path of cert & key file
      var keyPath   = this.config.get('config').protocol.certificate.key;
      var certPath  = this.config.get('config').protocol.certificate.cert;

      // Normalize keyPath and cert Path
      keyPath = !path.isAbsolute(keyPath) ? path.normalize([ process.cwd(), keyPath ].join('/')) :
        keyPath;
      certPath = !path.isAbsolute(certPath) ? path.normalize([ process.cwd(), certPath ].join('/')) :
        certPath;

      // Generate credidentials
      var privateKey  = fs.readFileSync(keyPath, 'utf8');
      var certificate = fs.readFileSync(certPath, 'utf8');

      // Build credentials object for server
      var credentials = {
        key  : privateKey,
        cert : certificate
      };

      // Add override listen method to lisen to https
      this.app.listen = function () {
        // Create server
        var server = https.createServer(credentials, this);

        // Return new server with data

        return server.listen.apply(server, arguments);
      }.bind(this.app);
    }

    // Valid statement
    return true;
  }

  // Invalid statement
  return false;
};

/**
 * Enable stack error
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processStackError = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processStackError ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  //  Getting data
  var state = this.config.get('config').app.stackError || true;

  // Setting up stack error
  this.app.set('showStackError', state);

  // Log state message
  this.logger.info([ '[ Express.enableStackError ] -',
    state ? 'Enabling' : 'Disabling', 'showStackError' ].join(' '));

  // Default statement
  return true;
};

/**
 * Enable / Disable pretty HTML output
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processPrettyHTML = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processPrettyHTML ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Checking data
  var state = this.config.get('config').express.prettyHTML || true;

  // Set value
  this.app.locals.pretty = state;

  // Log state message
  this.logger.info([ '[ Express.processPrettyHTML] -',
    state ? 'Enabling' : 'Disabling', 'pretty HTML' ].join(' '));

  // Default statement
  return true;
};

/**
 * Process view engine setting
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processViewEngine = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processViewEngine ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Current engine name
  var name = this.config.get('config').express.viewEngine || 'jade';

  // Adding consolidatejs
  this.app.engine(name, consolidate[name]);

  // Change view engine
  this.app.set('view engine', name);

  // Log message
  this.logger.info([ '[ Express.processViewEngine ] - Setting view engine to [',
    this.app.get('view engine'), ']' ].join(' '));

  // Default statement
  return true;
};

/**
 * Process directory path to use on app
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processDirectory = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processDirectory ] -',
      'Cannot process config. App is not ready.' ].join(''));

    // Invalid statement
    return false;
  }

  // Default directory list
  var directories = this.config.get('config').directory;

  // Reading config file
  _.each(directories, function (d) {
    // Process
    this.useDirectory(_.first(Object.keys(d)));
  }.bind(this));

  // Default statement
  return true;
};

/**
 * Setting up favicon
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processFavicon = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processFavicon ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Default path
  var p = this.config.ICONS_DIRECTORY;

  // Is relative path ?
  if (!path.isAbsolute(p)) {
    // Normalize path
    p = path.normalize([ process.cwd(), p ].join('/'));
  }

  // Build path
  var fav = [ p, 'favicon.ico' ].join('/');

  // File exists ?
  if (fs.existsSync(fav)) {
    // Set and log
    this.logger.info([ '[ Express.useFavicon ] - Adding favicon : ', fav ].join(' '));

    // Use
    this.app.use(favicon(fav, {
      maxAge : 2592000000
    }));
  } else {
    // Error
    this.logger.warning([ '[ Express.useFavicon ] - Favicon doesn\'t exist.',
      'Checking path [', fav, '] failed' ].join(' '));
  }

  // Default statement
  return true;
};

/**
 * Process default compression
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processCompression = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processCompression ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Getting express config
  var eConfig = this.config.get('config').express;

  // Setting up filter for express compression
  if (!_.isUndefined(eConfig.filter)) {
    // Getting filter
    var eFilter = eConfig.filter || {};

    // Testing rules
    if (_.isString(eFilter.rules) && _.isString(eFilter.by) && _.isNumber(eFilter.level)) {
      // Processsing
      this.logger.info([ '[ Express.processCompression ] -',
        'Setting up compression rules with filter [',
        eFilter.rules, '] for [', eFilter.by, '] at level [',
        _.parseInt(eFilter.level), ']'
      ].join(' '));

      // Set up
      this.app.use(compression({
        filter : function (request, response) {
          // Has header with no compression rules ?
          if (_.has(request, 'headers') && request.headers['x-no-compression']) {
            return false;
          }

          // Main compression process
          var rules = new RegExp(eFilter.rules);

          // Return tests

          return rules.test(response.getHeader(eFilter.by));
        },
        level : _.parseInt(eFilter.level)
      }));
    }
  }

  // Default statement
  return true;
};

/**
 * Process jsoncallback state
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processJsonCallack = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processJsonCallack ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get config
  var state = this.config.get('config').express.jsonp;

  // Log specific message
  this.logger[state ? 'info' : 'warning']([ '[ Express.processJsonCallack ] -',
    state ? 'Enable' : 'Disable',
    'JSONP for express' ].join(' '));

  // Process
  this.app.enable('jsonp callback', state);

  // Default statement
  return true;
};

/**
 * Process CookieParser state
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processCookieParser = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processCookieParser ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get config
  var parser = this.config.get('config').express.cookieParser;

  // Log specific message
  this.logger[parser.enable ? 'info' : 'warning']([ '[ Express.processCookieParser ] -',
    parser.enable ? 'Enable' : 'Disable',
    'cookieParser' ].join(' '));

  // Process
  if (parser.enable) {
    this.app.use(cookieParser(parser.secret, parser.options));
  }

  // Default statement
  return true;
};

/**
 * Process BodyParser configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processBodyParser = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processBodyParser ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // For the moment allow only this
  var rules = [ 'json', 'urlencoded' ];

  // Parse rules
  _.each(rules, function (rule) {
    // Get current
    var r = this.config.get('config').express[rule];

    // Logging message
    this.logger.info([ '[ Express.configure.processBodyParser ] - Setting up [', rule,
      '] parser' ].join(' '));
    this.logger.debug([ '[ Express.configure.processBodyParser ] - Used params for [', rule,
      '] config are :', utils.obj.inspect(r) ].join(' '));

    // Setting up body parser
    this.app.use(bodyParser[rule](r));
  }.bind(this));

  // Default statement
  return true;
};

/**
 * Process methodOverride configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processMethodOverride = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processMethodOverride ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get all methods
  var methods = this.config.get('config').express.methodOverride;

  // Parse available methods
  _.each(methods, function (method) {
    this.logger.info([ '[ Express.processMethodOverride ] - Setting up methodOverride to use [',
      method, '] header rules' ].join(' '));
  }.bind(this));

  // Default statement
  return true;
};

/**
 * Process processSession configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processSession = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processSession ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get session data
  var s = this.config.get('config').express.session;

  // Session is enable ?
  if (s.enable) {
    // Need uuid generator ?
    if (s.options.genuuid) {
      // Gen function
      var gen = function () {
        return uuid.v4();
      };

      // Remove state flag non needed on session middleware options
      delete s.options.genuuid;

      // Extend options with new genid function
      _.extend(s.options, {
        genid : gen
      });
    }
  }

  // Trust proxy ?
  if (s.options.proxy) {
    this.logger.info('[ Express.processSession ] - Enable proxy trust for current express app');

    // Trust proxy
    this.app.set('trust proxy', 1);
  }

  // Save it
  var opStore = _.clone(s.options.store);

  // Remove it specific process

  delete s.options.store;

  // Has store rules ?
  if (!_.isUndefined(opStore)) {
    // Set defaults instance and type
    var instance  = opStore.instance || 'mongo';
    var type      = opStore.type || 'uri';

    // Is uri ? and is String ? ant not empty ?
    if (instance === 'mongo' && type === 'uri' &&
        _.isString(opStore.uri) && !_.isEmpty(opStore.uri)) {
      // Check if property sslCA exist
      if (_.has(opStore.options, 'server.sslCA') && _.isString(opStore.options.server.sslCA)) {
        // Create buffer of this file
        opStore.options.server.sslCA = [
          fs.readFileSync(path.normalize(process.cwd() + '/' + opStore.options.server.sslCA))
        ];
      }

      // Check if property sslKey exist
      if (_.has(opStore.options, 'server.sslKey') && _.isString(opStore.options.server.sslKey)) {
        // Create buffer of this file
        opStore.options.server.sslKey =
          fs.readFileSync(path.normalize(process.cwd() + '/' + opStore.options.server.sslKey));
      }

      // Check if property sslCert exist
      if (_.has(opStore.options, 'server.sslCert') && _.isString(opStore.options.server.sslCert)) {
        // Create buffer of this file
        opStore.options.server.sslCert =
          fs.readFileSync(path.normalize(process.cwd() + '/' + opStore.options.server.sslCert));
      }

      // Set store data
      _.extend(s.options, {
        store : new MongoStore({
          url          : opStore.uri,
          mongoOptions : opStore.options || {}
        })
      });
    } else {
      // Warning another type than uri
      // BUT : we need to implement it
      this.logger.warning([ '[ Express.processSession ] -',
        'Session storage rules given is not an uri type.',
        'Need to implement', type, 'process' ].join(' '));
    }
  }

  // Log message
  this.logger.info([ '[ Express.processSession ] -',
    'Setting up expression session middleware support for current express app'
  ].join(' '));
  this.logger.debug([ '[ Express.processSession ] -',
    'Config data used for session setting are : ',
    utils.obj.inspect(s.options)
  ].join(' '));

  // Default session
  var sessionInstance = session(s.options);

  // Process assignement

  this.app.use(sessionInstance);

  // Expose session on app for some case of usage
  this.app.set('session', sessionInstance);

  // Default statement
  return true;
};

/**
 * Process processMultipart configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processMultipart = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processMultipart ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get multipart state
  var m = this.config.get('config').express.multipart;

  // Enable multiplart ?
  if (m) {
    // Log
    this.logger.info([ '[ Express.processMultipart ] -',
      'Setting up multipart support for current express app' ].join(' '));

    // Setting up multipart
    this.app.use(multipart());
  }

  // Default statement
  return true;
};

/**
 * Process security configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processSecurity = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processSecurity ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get security data
  var security = this.config.get('config').express.security;

  // Security is enable ?
  if (security.enable) {
    // Parse all object keys
    _.each(Object.keys(_.omit(security, [ 'enable' ])), function (rule) {
      // Use rules ?
      if (!_.isEmpty(rule) && rule !== 'csrf') {
        // Log message
        this.logger.info([ '[ Express.processSecurity ] - Setting up [', rule.toUpperCase(),
          '] rules for current express app' ].join(' '));
        this.logger.debug([ '[ Express.processSecurity ] - Config data used for',
          rule.toUpperCase(),
          'setting are : ', utils.obj.inspect(security[rule]) ].join(' '));

        if (rule !== 'nosniff') {
          // Process
          this.app.use(lusca[rule](security[rule]));
        } else {
          // Enable without param
          if (_.isBoolean(security[rule])) {
            // Enable with default construct
            this.app.use(lusca[rule]());
          }
        }
      }
    }.bind(this));
  }

  // Default statement
  return true;
};

/**
 * Process Seo Rendering configuration
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processPrerender = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processPrerender ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get security data
  var pr      = this.config.get('config').prerender;
  var ready   = false;

  // Is defined ?
  if (!_.isUndefined(pr)) {
    // Process change host before
    prerender.set('beforeRender', function (req, done) {
      // Get host from request
      var host = utils.request.getHost(req);

      // Is valid host

      if (_.isString(host)) {
        // Replace host protocol
        host = host.replace('http://', '');

        // Change headers host
        req.headers.host = host;
      }

      // Done do next
      done();
    });

    // Has token ?
    if (_.has(pr, 'prerenderToken')) {
      // Yes so set
      prerender.set('prerenderToken', pr.prerenderToken);

      // Message
      this.logger.debug([ '[ Express.processPrerender ] - Add token :',
        pr.prerenderToken,
        'for prerender service' ].join(' '));

      // For change state
      ready = true;
    }

    // Has serviceUrl  ?
    if (_.has(pr, 'prerenderServiceUrl')) {
      // Yes so set url
      prerender.set('prerenderServiceUrl', pr.prerenderServiceUrl);

      // Message
      this.logger.debug([ '[ Express.processPrerender ] - Add service url :',
        pr.prerenderServiceUrl,
        'for prerender service' ].join(' '));

      // For change state
      ready = true;
    }

    // Has serviceUrl ?
    if (_.has(pr, 'blacklisted')) {
      // Yes add blacklisted
      prerender.blacklisted(pr.blacklisted);

      // Message
      this.logger.debug([ '[ Express.processPrerender ] - Add blacklist rules :',
        utils.obj.inspect(pr.blacklisted),
        'for prerender service' ].join(' '));
    }

    // Has serviceUrl ?
    if (_.has(pr, 'additionalAgents')) {
      // Yes add
      _.each(pr.additionalAgents, function (agent) {
        prerender.crawlerUserAgents.push(agent);
      });
    }

    // Is ready to set ?
    if (ready) {
      // Here before it's look like that we need to process a before render but is local
      // installation case it looks like that we dont need this so we decide to
      // delete it and use a specific seo render program
      // nothing to do but is seo process so build a message
      this.logger.info('[ Express.processPrerender ] - Setting up on express.');

      // Use prerender
      this.app.use(prerender);
    } else {
      // Warning message have data but not all
      this.logger.warning([ '[ Express.processPrerender ] -',
        'Setup failed. token or service url is missing' ].join(' '));

      // Is here an error occured
      return false;
    }
  } else {
    // Nothing to do but is seo process so build a message
    this.logger.info('[ Express.processPrerender ] - nothing to process prerender is disabled.');
  }

  // Default statement
  return true;
};

/**
 * Process JWT token process for express
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processJwt = function () {
  // Create async process
  var deferred = Q.defer();

  // Config is ready ?

  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processJwt ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    deferred.reject();
  }

  // Get security data
  var jwtoken   = this.config.get('config').jwt;

  // Required jwt here for custom logger
  var jwt       = yoctoJwt(this.logger);

  // All is ok ?
  if (_.isBoolean(jwtoken.enable) && jwtoken.enable &&
      _.isString(jwtoken.key) && !_.isEmpty(jwtoken.key)) {
    // Debug message
    this.logger.debug('[ Express.processJwt ] - Try to process jwt key');

    // Set current algorithm
    jwt.algorithm(jwtoken.algorithm || 'HS256');

    // Load item
    jwt.load().then(function () {
      // Add alowed ips
      jwt.allowedIps(jwtoken.ips || []);

      // Add alowed routes
      jwt.addAllowedRoutes(jwtoken.allowedRoutes || []);

      // Set key
      if (jwt.setKey(jwtoken.key)) {
        // Add autorize middleware for automatic check
        this.app.use(jwt.isAuthorized());

        // Messsage
        this.logger.info('[ Express.processJwt ] - Check json request autorization enabled.');

        // Check if middleware should be set
        if (jwtoken.autoEncryptRequest) {
          // Enable auto encrypt json request
          this.app.use(jwt.autoEncryptRequest());

          // Messsage
          this.logger.info('[ Express.processJwt ] - Auto encrypt json response enabled.');
        }

        // Check if middleware should be set
        if (jwtoken.autoDecryptRequest) {
          // Enable auto decrypt json request
          this.app.use(jwt.autoDecryptRequest());

          // Messsage
          this.logger.info('[ Express.processJwt ] - Auto decrypt json request enabled.');
        }

        // Expose jwt on app
        this.app.set('jwt', jwt);

        // Resolve and continue
        deferred.resolve();
      }
    }.bind(this)).catch(function (error) {
      // Log error message
      this.logger.error(error);

      // Reject
      deferred.reject(error);
    }.bind(this));
  } else {
    // Message
    this.logger.info('[ Express.processJwt ] - Nothing to process. jwt is disabled.');

    // Resolve and continue
    deferred.resolve();
  }

  // Default statement
  return deferred.promise;
};

/**
 * Process CORS process for express
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.processCors = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processCors ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get security data
  var enableCors      = this.config.get('config').cors;

  // Cors config
  var corsConfig      = this.config.get('config').corsCfg;

  // All is ok ?

  if (_.isBoolean(enableCors) && enableCors) {
    // Debug message
    this.logger.debug('[ Express.processCors ] - Try to enable CORS on app.');

    // Has config ?
    if (_.isObject(corsConfig) && !_.isEmpty(corsConfig)) {
      // Debug message
      this.logger.debug([ '[ Express.processCors ] - CORS is enabled with a custom config :',
        utils.obj.inspect(corsConfig) ].join(' '));

      // Add cors with config
      this.app.use(cors(corsConfig));
    } else {
      // Add cors
      this.app.use(cors());
    }

    // Message
    this.logger.info('[ Express.processCors ] - CORS is enable for all routes.');
  } else {
    // Message
    this.logger.info('[ Express.processCors ] - Nothing to process. CORS is disabled.');
  }

  // Default statement
  return true;
};

/**
 * Enable redirect rules for current application defined on config file
 *
 *  @return {Boolean} Result of method
 */
Express.prototype.processRedirect = function () {
  // Config is ready ?
  if (!this.isReady()) {
    // Error message
    this.logger.error([ '[ Express.processRedirect ] -',
      'Cannot process config. App is not ready.' ].join(' '));

    // Invalid statement
    return false;
  }

  // Get redirect data
  var redirect = this.config.get('config').redirect;

  // Disable www redirect

  if (redirect) {
    // Log message
    this.logger.info('[ Express.processRedirect ] - redirect rules are defined, processs it ...');

    // Has redirect ?
    if (redirect.www) {
      // Log message
      this.logger.info('[ Express.processRedirect ] - Enable 301 www redirection ...');

      // Set it
      this.app.use(function (req, res, next) {
        // Get current host
        var host = utils.request.getHost(req);

        // Check it

        if (!_.startsWith(host, 'www.')) {
          // Default redirect
          return res.redirect(301, [ req.protocol, '://www.', host, req.originalUrl ].join(''));
        }

        // Do next process
        next();
      });
    }

    // Is on request list
    if (_.has(redirect, 'seo') && _.isArray(redirect.seo) && !_.isEmpty(redirect.seo)) {
      // Log message
      this.logger.info('[ Express.processRedirect ] - enable redirect for custom url');

      // Set it
      this.app.use(function (req, res, next) {
        // Get current host
        var host = utils.request.getHost(req);

        // Validation schema
        var schema = joi.object().required().keys({
          code        : joi.number().required().valid([ 301, 302 ]),
          fromUrl     : joi.string().required().empty(),
          toUrl       : joi.string().required().empty(),
          queryString : joi.boolean().optional().default(false)
        });

        // Get correct url
        var obj = _.find(redirect.seo, function (item) {
          // Default statement
          return item.fromUrl === req.originalUrl;
        });

        // Item was founded ?
        if (!_.isUndefined(obj)) {
          // Schema validation
          var validate = joi.validate(obj, schema);

          // Has no error ?
          if (_.isNull(validate.error)) {
            // Has query string ?
            var qse = url.parse(validate.value.fromUrl);

            // Default endUrl
            var endUrl = [ req.protocol, '://', host, validate.value.toUrl ].join('');

            // Is absolute url ?
            if (_.startsWith(validate.value.toUrl, 'http') ||
              _.startsWith(validate.value.toUrl, 'https')) {
              // Change endUrl to use full defined url
              endUrl = validate.value.toUrl;
            }

            // Add original query string to desitnation url ?
            if (validate.value.queryString && !_.isNull(qse.query)) {
              // Destination url as sub routes ?
              var qsee = url.parse(endUrl);

              // Path is already defined and href url not ending by a slash ?

              if (_.isNull(qsee.path) && !_.endsWith(qsee.href, '/')) {
                // Add slash at the end for query process
                endUrl = [ endUrl , '/' ].join('');
              }

              // Build with extract query string
              endUrl = [ endUrl, qse.query ].join('?');
            }

            // Default redirect statement
            return res.redirect(validate.value.code, endUrl);
          }
        }

        // Do next process
        next();
      });
    }
  }

  // Default statement
  return true;
};

/**
 * Get current state of config load
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.isReady = function () {
  // Default statement
  return this.state && this.config.state;
};

/**
 * Defaut method to process initialize without config loading.
 *
 * @param {Object} data to use
 * @param {Boolean} isConfigInstance if is set to true this.config must be replace by data
 * @return {Object} result of promise
 */
Express.prototype.configureWithoutLoad = function (data, isConfigInstance) {
  // Create async process
  var deferred  = Q.defer();

  // Normalize a config instance
  isConfigInstance = _.isBoolean(isConfigInstance) ? isConfigInstance : false;

  // If is a config instance
  if (isConfigInstance) {
    // Force rewrite config
    this.config = data;

    // State must to true
    this.state = true;
  }

  // Define here all call method to process in parallel
  var methods = [
    {
      name      : 'processBase',
      exception : 'Express base initialisation failed.',
      banner    : false
    },
    {
      name      : 'processStackError',
      exception : 'Stack error setup failed.',
      banner    : false
    },
    {
      name      : 'processPrettyHTML',
      exception : 'Pretty HTTML setup failed.',
      banner    : false
    },
    {
      name      : 'processViewEngine',
      exception : 'View engine setup failed.',
      banner    : false
    },
    {
      name      : 'processCompression',
      exception : 'Compression setup failed',
      banner    : false
    },
    {
      name      : 'processDirectory',
      exception : 'Directory setup failed.',
      banner    : false
    },
    {
      name      : 'processFavicon',
      exception : 'Favicon setup failed.',
      banner    : false
    },
    {
      name      : 'processJsonCallack',
      exception : 'JsonCallback setup failed.',
      banner    : false
    },
    {
      name      : 'processCookieParser',
      exception : 'CookieParser setup failed.',
      banner    : false
    },
    {
      name      : 'processBodyParser',
      exception : 'BodyParser setup failed.',
      banner    : false
    },
    {
      name      : 'processMethodOverride',
      exception : 'MethodOverride setup failed.',
      banner    : false
    },
    {
      name      : 'processSession',
      exception : 'Session setup failed.',
      banner    : false
    },
    {
      name      : 'processMultipart',
      exception : 'Multipart setup failed.',
      banner    : false
    },
    {
      name      : 'processRedirect',
      exception : 'Redirect setup failed.',
      banner    : false
    },
    {
      name      : '',
      exception : 'Processing security rules',
      banner    : true
    },
    {
      name      : 'processSecurity',
      exception : 'Security setup failed.',
      banner    : false
    },
    {
      name      : 'processCors',
      exception : 'Cors setup failed.',
      banner    : false
    },
    {
      name      : '',
      exception : 'Setting up Seo renderer system',
      banner    : true
    },
    {
      name      : 'processPrerender',
      exception : 'Prerender setup failed.',
      banner    : false
    },
    {
      name      : '',
      exception : 'Setting up Jwt crypt/decrypt',
      banner    : true
    }
  ];

  // Error storage
  var errors = [ ];

  // Parse all methods
  async.each(methods, function (method, next) {
    // Is valid item ?
    if (!method.banner && !_.isEmpty(method.name)) {
      // Call succeed ?
      if (!this[method.name](this)) {
        // Push exception message in errors storage
        errors.push(method.exception);
      }
    } else {
      // Log message
      this.logger.banner([ '[ Express.configure ] - Initializing Express >',
        method.exception, '...' ].join(' '));
    }

    // Go to next item
    next();
  }.bind(this), function () {
    // Has errors ?
    if (!_.isEmpty(errors)) {
      // Log errors
      this.logger.error([ '[ Express.configure ] - Initializing Express Failed. Errors occured :\n',
        _.map(errors, function (error) {
          return [ _.repeat('\t', 4),' |--->', error, '\n' ].join(' ');
        }).join('') ].join(' '));

      // Reject
      deferred.reject(errors);
    } else {
      // Process jwt
      // setup jwt
      this.processJwt().then(function () {
        // Setting up router
        this.logger.banner('[ Express.configure ] - Setting up Router for current express app');

        // Enable express router
        this.app.use(express.Router());

        // Ok message
        this.logger.info('[ Express.configure ] - Express is ready to use ....');

        // All is okay so resolve
        deferred.resolve(this.app);
      }.bind(this)).catch(function (error) {
        // Reject
        deferred.reject([ 'Jwt setup failed.', error ].join(' '));
      });
    }
  }.bind(this));

  // Default statement
  return deferred.promise;
};

/**
 * Default configure option
 *
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.configure = function () {
  // Create async process
  var deferred  = Q.defer();

  // Welcome message ...
  this.logger.banner('[ Express.configure ] - Initializing Express ...');

  // Main process
  this.config.load().then(function (success) {
    // State is success
    this.state = _.isObject(success) && !_.isEmpty(success);

    // Process without load
    this.configureWithoutLoad(success).then(function (wdata) {
      // Resolve
      deferred.resolve(wdata);
    }).catch(function (werror) {
      // Reject
      deferred.reject(werror);
    });
  }.bind(this)).catch(function (error) {
    // Error message
    this.logger.error('Invalid config given. Please check your config files');

    // Reject with error
    deferred.reject(error);
  }.bind(this));

  // Default statement
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
  // Checking name
  if (_.isString(name) && !_.isEmpty(name)) {
    // Default path
    p = _.isString(p) &&
       !_.isEmpty(p) ? p : this.config[[ name, 'DIRECTORY' ].join('_').toUpperCase()] || name;

    // Is relative path ?
    if (!path.isAbsolute(p)) {
      // Normalize path
      p = path.normalize([ process.cwd(), p ].join('/'));
    }

    // Directory exist ?
    if (fs.existsSync(p)) {
      // Adding ? log it
      this.logger.info([ '[ Express.useDirectory ] - Adding directory', p,
        'on express app' ].join(' '));

      if (name !== 'views') {
        // Set static directory
        this.app.use(express.static(p, this.config.get('config').express.staticServe));
      } else {
        // Set views
        this.app.set(name, p);
      }

      // Return success statement
      return true;
    }

    // Log message
    this.logger.warning([ '[ Express.useDirectory ] - Cannot add directory', name,
      'on express app. Directory [', p, '] does not exist' ].join(' '));
  }

  // Return failed statement
  return false;
};

/**
 * Removing middleware form key name
 *
 * @param {String} name name of middleware to remove
 * @return {Array} list of middleware
 */
Express.prototype.removeMiddleware = function (name) {
  // Default state
  var state = false;

  // Parse router stack
  var middlewareIndex = _.findIndex(_.get(this.app, '_router.stack'), 'name', name);

  // If correct index ?
  if (middlewareIndex >= 0) {
    // Remove item on stack
    _.get(this.app, '_router.stack').splice(middlewareIndex, 1);

    // Change state
    state = true;
  }

  // Log
  this.logger[state ? 'info' : 'warning']([ '[ Express.removeMiddleware ] -',
    'removing middleware', name,
    state ? 'success' :
      'failed. Middleware does not exist' ].join(' '));

  // Return state
  return state;
};

/**
 * Get set function, assign given data to a property
 *
 * @param {String} name name of property
 * @param {Mixed} value value of property
 * @return {Object} current instance
 */
Express.prototype.set = function (name, value) {
  // Check requirements
  if (!_.isUndefined(name) && _.isString(name) && !_.isEmpty(name)) {
    // Assign value
    this[name] = value;
  } else {
    // Log a warning messsage.
    this.logger.warning([ '[ Express.set ] - Invalid value given.',
      'name must be a string and not empty. Operation aborted !' ].join(' '));
  }

  // Returning current instance
  return this;
};

// Default export
module.exports = function (c, l) {
  // Is a valid logger ?
  if (_.isUndefined(l) || _.isNull(l)) {
    logger.warning('[ Express.constructor ] - Invalid logger given. Use internal logger');

    // Assign
    l = logger;
  }

  // Is a valid config ?
  if (_.isUndefined(c) || _.isNull(c)) {
    logger.warning('[ Express.constructor ] - Invalid config given. Use internal config');

    // Assign
    c = config(l);

    // Auto enableExpress
    c.enableExpress();
  }

  // Default statement
  return new Express(c, l);
};
