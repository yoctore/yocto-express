'use strict';

/**
 *
 * @see : https://www.npmjs.org/package/uuid 
 * @see : https://www.npmjs.org/package/dateformat
 */
var df            = require('dateformat');
var uuid          = require('uuid');
var _             = require('lodash');
var logger        = require('yocto-logger');
var express       = require('express');
var config        = require('yocto-config');
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

// disable config log
//config.logger.enableConsole(false);

function Express(app) {
  /**
   * Default app name const
   * 
   * @property DEFAULT_APP_NAME
   * @type String
   */
  this.DEFAULT_APP_NAME = [ 'app-#', uuid.v4(), '-', df(new Date(), 'yyyymd') ].join('');
  
  /**
   * Default app instance
   * 
   * @property app
   * @type Object
   */
  this.app    = app;

  /**
   * Default logger instance
   * 
   * @property logger
   * @type Object
   */
  this.logger = logger;

  /**
   * Default config instance
   * 
   * @property config
   * @type Object
   */
  this.config = config;
}

/**
 * Get settings of express app
 * 
 * @method getSettings
 * @return {Object} settings object or empty object
 */
Express.prototype.getSettings = function() {
  // return object data
  return this.app.settings || {};
};

/**
 * Default configure option
 * 
 * @method configure
 * @return {Boolean} true if all is ok false otherwise
 */
Express.prototype.configure = function() {
  // welcome message ...
  this.logger.banner('[ Express.configure ] - Initializing Express ...');
  
  // main process
  try {
      if (!this.config.load()) {
        throw 'Invalid config given. Please check your config files';
      }
    
      // setting port
      this.app.set('port', this.config.get('config').port);
      this.logger.info([ '[ Express.configure ] - Setting port to [', this.app.get('port'), ']' ].join(' '));
      
      // set the default name 
      this.app.set('app_name', _.words(this.config.get('config').app.name.toLowerCase()).join('-'));
      this.logger.info([ '[ Express.configure ] - Setting app name to [', this.app.get('app_name'), ']' ].join(' '));
      
      // setting up env
      this.app.set('env', this.config.get('config').env);
      this.logger.info([ '[ Express.configure ] - Setting env to [', this.app.get('env'), ']' ].join(' '));
      
      // setting up host
      this.app.set('host', this.config.get('config').host);
      this.logger.info([ '[ Express.configure ] - Setting host to [', this.app.get('host'), ']' ].join(' '));      
      
      /**
       * Enable stack error
       *
       * @method enableStackError
       * @param {Object} context current context to use
       */
      var processStackError = function(context) {
        //  getting data
        var state = context.config.get('config').app.stackError || true;
        
        // setting up stack error
        context.app.set('showStackError', state);
      
        // log state message  
        context.logger.info([ '[ Express.configure.enableStackError ] -', (state ? 'Enabling' : 'Disabling'), 'showStackError' ].join(' '));
      };

      /**
       * Enable pretty HTML output
       *
       * @method enablePrettyHTML
       * @param {Object} context current context to use
       */
      var processPrettyHTML = function(context) { 
        // Checking data
        var state = context.config.get('config').express.prettyHTML || true;
      
        // set value
        context.app.locals.pretty = state;
        // log state message  
        context.logger.info([ '[ Express.configure.enablePrettyHTML] -', (state ? 'Enabling' : 'Disabling'), 'pretty HTML' ].join(' '));
      };

      /**
       * Process view engine setting 
       *
       * @method processViewEngine
       * @param {Object} context current context to use
       */
      var processViewEngine = function(context) {
        // default view engine
        
        // TODO => Implement other template engine if possible Like dust or handlebars
        var name = context.config.get('config').express.viewEngine || 'jade';

        // adding consolidatejs        
        context.app.engine(name, consolidate.swig);

        // change view engine                
        context.app.set('view engine', name);
        // log message
        context.logger.info([ '[ Express.configure.processViewEngine ] - Setting view engine to [', context.app.get('view engine'), ']' ].join(' '));        
      };

      /**
       * Process directory path to use on app
       *
       * @method processDirectory
       * @param {Object} context current context to use
       */
      var processDirectory = function(context) {
        // default directory list
        var dir = context.config.get('config').directory;

        // reading config file
        _.each(dir, function(d) {
          // process
          context.useDirectory(_.first(Object.keys(d)));
        }, context);
      };
      
      /**
       * Setting up favicon
       *
       * @method processFavicon
       * @param {Object} context current context to use
       */
      var processFavicon = function(context) {
        // default path
        var p = context.config.ICONS_DIRECTORY;
      
        // is relative path ?
        if (p.charAt(0) == '.') {
          // normalize path
          p = path.normalize([ process.cwd(), p ].join('/'));  
        }
        
        // build path
        var fav = [ p, 'favicon.ico' ].join('/');
      
        // file exists ?
        if (fs.existsSync(fav)) {
          // set and log
          context.logger.info([ '[ Express.configure.useFavicon ] - Adding favicon : ', fav ].join(' ')); 
          context.app.use(favicon(fav,  { maxAge : 2592000000 } ));
        } else {
          // error
          logger.warning([ "[ Express.configure.useFavicon ] - Favicon doesn't exist. Checking path [", fav, '] failed' ].join(' '));
        }
      };

      /**
       * process default compression
       *
       * @method processCompression
       * @param {Object} context current context to use
       */
      var processCompression = function(context) {
        // Getting express config
        var eConfig = context.config.get('config').express;
  
        // Setting up filter for express compression
        if (!(_.isUndefined(eConfig.filter))) {
        
          // getting filter
          var eFilter = eConfig.filter;
        
          // testing rules
          if (!(_.isUndefined(eFilter.rules)) && !(_.isUndefined(eFilter.by)) && !(_.isUndefined(eFilter.level))) {
            if ((_.isString(eFilter.rules)) && (_.isString(eFilter.by)) && (_.isNumber(eFilter.level))) {
              
              // processsing
              context.logger.info([ '[ Express.configure.enableCompression ] - Setting up compression rules with filter [', eFilter.rules, '] for [', eFilter.by, '] at level [', _.parseInt(eFilter.level), ']'].join(' '));
              context.app.use(compression({
                filter : function(request, response) {
                  
                  // has header with no compression rules ?
                  if (_.has(request, 'headers') && request.headers['x-no-compression']) {
                    return false; 
                  }
                  
                  // main compression process
                  var rules = new RegExp(eFilter.rules);
                  return rules.test(response.getHeader(eFilter.by));
                },
                level : _.parseInt(eFilter.level)
              }));
            }
          }
        } 
      };

      /**
       * process jsoncallback state
       *
       * @method processJsonCallack
       * @param {Object} context current context to use
       */
      var processJsonCallack = function(context) {
        
        // get config
        var state = context.config.get('config').express.jsonp;

        // log specific message
        context.logger[ (state ? 'info' : 'warning' )]([ '[ Express.configure.processJsonCallack ] -', (state ? 'Enable' : 'Disable'), 'JSONP for express' ] .join(' '));
        
        // process
        context.app.enable('jsonp callback', state);
      };

      /**
       * process CookieParser state
       *
       * @method processCookieParser
       * @param {Object} context current context to use
       */
      var processCookieParser = function(context) {
        // get config
        var parser = context.config.get('config').express.cookieParser;

        // log specific message
        context.logger[ (parser.enable ? 'info' : 'warning' )]([ '[ Express.configure.processCookieParser ] -', (parser.enable ? 'Enable' : 'Disable'), 'cookieParser' ] .join(' '));
        
        // process
        if (parser.enable) {          
          context.app.use(cookieParser(parser.secret, parser.options));
        }
      };

      /**
       * process BodyParser configuration
       *
       * @method processBodyParser
       * @param {Object} context current context to use
       */
      var processBodyParser = function(context, rules) {
        // get current
        var r = context.config.get('config').express[rules];
        
        // loggin message
        context.logger.info([ '[ Express.configure.processBodyParser ] - Setting up [', rules, '] parser' ].join(' '));
        context.logger.debug([ '[ Express.configure.processBodyParser ] - Used params for [', rules, '] config are :', utils.strings.inspect(r, false) ].join(' '));
        
        // setting up body parser
        context.app.use(bodyParser[rules](r));
      };

      /**
       * process methodOverride configuration
       *
       * @method processMethodOverride
       * @param {Object} context current context to use
       */      
      var processMethodOverride = function(context) {
        // get all methods
        var methods = context.config.get('config').express.methodOverride;
        // parse available methods
        _.each(methods, function(method) {
          context.logger.info([ '[ Express.configure.processMethodOverride ] - Setting up methodOverride to use [', method, '] header rules' ].join(' '));
        }, context);
      };

      /**
       * process processSession configuration
       *
       * @method processSession
       * @param {Object} context current context to use
       */   
      var processSession = function(context) {
        // get session data
        var s = context.config.get('config').express.session;
        
        // session is enable ?
        if (s.enable) {

          // need uuid generator ?
          if (s.options.genuuid) {
            
            // gen function
            var gen = function() {
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
          context.logger.info('[ Express.configure.processSession ] - Enable proxy trust for current express app');
          context.app.set('trust proxy', 1); // trust proxy
        }
        
        // log message
        context.logger.info('[ Express.configure.processSession ] - Setting up expression session middleware support for current express app');
        context.logger.debug([ '[ Express.configure.processSession ] - Config data used for session setting are : ', utils.strings.inspect(s.options, false) ].join(' '));

        // is production or staging mode ?
        if (context.app.get('env') != 'development') {
          // force secure cookie
          s.options.cookie.secure = true;
        }
        
        // process assignement
        context.app.use(session(s.options));
      };

      /**
       * process processMultipart configuration
       *
       * @method processMultipart
       * @param {Object} context current context to use
       */
      var processMultipart = function(context) {
        // get multipart state
        var m = context.config.get('config').express.multipart;

        // enable multiplart ?
        if (m) {
          context.logger.info('[ Express.configure.processMultipart ] - Setting up multipart support for current express app');
          // setting up multipart
          context.app.use(multipart());                  
        }
      };

      var processSecurity = function(context) {
        // get security data 
        var security = context.config.get('config').express.security;

        _.each(Object.keys(security), function(rule) {
          // use rules ?        
          if (!_.isEmpty(rule)) {
  
            // log message
            context.logger.info([ '[ Express.configure.processSecurity ] - Setting up [', rule.toUpperCase(), '] rules for current express app' ].join(' '));
            context.logger.debug([ '[ Express.configure.processSecurity ] - Config data used for', rule.toUpperCase(), 'setting are : ', utils.strings.inspect(security[rule], false) ].join(' '));
  
            // process
            context.app.use(lusca[rule](security[rule]));
          }          
        }, context);
      };

      // process stack error      
      processStackError(this);
      
      // process pretty HTML
      processPrettyHTML(this);
      
      // process view engine
      processViewEngine(this);

      // process directory path
      processDirectory(this);
      
      // process favicon
      processFavicon(this);

      // middleware process
      this.logger.banner('[ Express.configure ] - Initializing Express > Processing middleware ...');
      
      // process compression
      processCompression(this);
      
      // TODO => Implement Vhost If needed, we need to check if is required or not (.htaccess process check needed)
      
      // process Jsonp Callback
      processJsonCallack(this);
      
      // process CookieParser
      processCookieParser(this);
      
      // body parser rules
      var brules = [ 'json', 'urlencoded' ];

      // process middleware
      _.each(brules, function(b) {
        // process body parser
        processBodyParser(this, b);        
      }, this);

      // process method override
      processMethodOverride(this);
      
      // process session
      processSession(this);
      
      // process multipart
      processMultipart(this);
      
      // middleware process
      this.logger.banner('[ Express.configure ] - Initializing Express > Processing security rules ...');      
      
      // enable security
      processSecurity(this);
      
      /**
       * Setting up router
       */
      this.logger.info('[ Express.configure ] - Setting up Router for current express app');    
      this.app.use(express.Router());

      // TODO => Implement i18n process with i18next-node for jade or makara for dust 
      // TODO => Implement https://github.com/auth0/node-jsonwebtoken for secure transaction between apps

      // All is ok !!! run the app      
      this.logger.info('[ Express.configure ] - Express is ready to use ....');   
      
  } catch (e) {
    this.logger.error([ '[ Express.configure ] - An Error occured during express initialization. error is :', e, 'Operation aborted !' ] .join(' '));
    return false;
  }

  // return true if all is valid 
  return true;
};

/**
 * Set directory to use on express app
 *
 * @method useDirectory
 * @param {String) name nape of path for bind from config file
 * @param {String} p path to use if we need to force the current path manually
 * @return {Boolean} true if success false otherwise
 */
Express.prototype.useDirectory = function(name, p) {
  // checking name
  if (!_.isUndefined(name) && !_.isNull(name) && _.isString(name) && !_.isEmpty(name)) {
    // default path
    p = !_.isUndefined(p) && !_.isNull(p) && _.isString(p) && !_.isEmpty(p) ? p : (this.config[[ name, 'DIRECTORY' ].join('_').toUpperCase()] || name);

    // is relative path ?
    if (p.charAt(0) == '.') {
      // normalize path
      p = path.normalize([ process.cwd(), p ].join('/'));  
    }
    
    // directory exist ?
    if (fs.existsSync(p)) {
      
      // adding ? log it
      this.logger.info([ '[ Express.useDirectory ] - Adding directory', p, 'on express app' ].join(' '));
      
      // if views ?? process are different !!!
      if (name != 'views') {
        // set static directory
        this.app.use(express.static(p));
      } else {
        // set views
        this.app.set(name, p);
      }
      
      // return success statement
      return true;
    }
    
    // log message
    this.logger.warning([ '[ Express.useDirectory ] - Cannot add directory', name, 'on express app. Directory [', p, '] does not exist' ].join(' '));
  }
  
  // return failed statement
  return false;
};

/**
 * Removing middleware form key name
 *
 * @method removeMiddleware
 * @param {String} name name of middleware to remove
 * @return {Array} list of middleware
 */
Express.prototype.removeMiddleware = function(name) {
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
  this.logger[ (state ? 'info' : 'warning') ]([ '[ Express.removeMiddleware ] - removing middleware', name, (state ? 'success' : 'failed. Middleware does not exist') ].join(' '));    
  
  // return state
  return state;
};

/**
 * get set function, assign given data to a property
 *
 * @method set
 * @param {String} name name of property
 * @param {Mixed} value value of property
 * @return {Object} current instance 
 */
Express.prototype.set = function(name, value) {
  // check requirements
  if (!_.isUndefined(name) && _.isString(name) && !_.isEmpty(name)) {    
    // assign value
    this[name] = value;  
  } else {
    // log a warning messsage.
    this.logger.warning('[ Express.set ] - Invalid value given. name must be a string and not empty. Operation aborted !');
  }
  
  // returning current instance
  return this;
};

// Instanciate express with default express engine.
// Set method is available for module usage or override
module.exports = new (Express)(express());