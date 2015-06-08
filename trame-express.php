/**
 * Dependencies
 * @documentation : https://github.com/strongloop/express
 * @see : http://expressjs.com/api.html
 * @see : http://nodejs.org/api/fs.html
 * @see : https://github.com/senchalabs/connect
 * @see : https://github.com/expressjs/compression
 * @see : https://github.com/expressjs/cookie-parser
 * @see : https://github.com/expressjs/body-parser
 * @see : https://github.com/expressjs/method-override
 * @see : https://github.com/expressjs/session
 * @see : https://www.npmjs.org/package/uuid
 * @see : https://www.npmjs.org/package/connect-flash
 * @see : https://github.com/epeli/underscore.string
 * @see : https://www.npmjs.org/package/dateformat
 * @see : https://www.npmjs.org/package/express-less
 * @see : https://www.npmjs.com/package/connect-multiparty
 * @see : https://www.npmjs.com/package/vhost
 * @see : https://github.com/senchalabs/connect
 * @see : https://www.npmjs.com/package/serve-static
 * @author :  Mathieu ROBERT <mathieu@yocto.re>
 * @copyright : Yocto SAS, All right reserved 
 */

var config          = require('./config');
var logger          = require(config.yoctoModules('logger'));
var social          = require(config.yoctoModules('social'));
var utils           = require(config.yoctoModules('utils'));
var fs              = require('fs');
var express         = require('express');
var compression     = require('compression');
var cookieParser    = require('cookie-parser'); 
var bodyParser      = require('body-parser');
var methodOverride  = require('method-override');
var session         = require('express-session');
var helpers         = require('view-helpers');
var _               = require('underscore');
var uuid            = require('uuid');
var flash           = require('connect-flash');
var _s              = require('underscore.string');
var df              = require('dateformat');
var multipart       = require('connect-multiparty');
var vhost           = require('vhost');
var connect         = require('connect');
var favicon         = require('serve-favicon');
var render          = require(config.yoctoModules('render'));
var prerender       = require('prerender-node');

// setting up pre-render
prerender.set('prerenderToken', 'mRVbkWNCFzaWWUeq4y0y');
// blacklist ad item
prerender.blacklisted(['/ad/.*/.*/ad-.{32}-[0-9]*.html']);

// add woo boot on config for seo test
prerender.crawlerUserAgents.push('woobot');

// hard force for prerender;
prerender.set('beforeRender', function(req, done) {
    var host = utils.getCorrectHost(req);
    host = host.replace('http://', '');
    req.headers.host = host;
    done();
});

// mixin underscore js ans underscore.string js to use the same namespace
_.mixin(_s.exports());

module.exports = function(app) {

  logger.banner('Initializing Express ...');
  
  var constants = config.constants;

     // Setting up vhost and http edirect 
    if (!_.isUndefined(eConfig.vhost)) {
      var vhostConfig = eConfig.vhost;

      var vhostapp = connect();

      if (!_.isUndefined(vhostConfig.enable)) {
        if (vhostConfig.enable) {
          logger.debug('Vhost setting is enable. Starting set up');
          
          if (!_.isUndefined(vhostConfig.url) && !_.isUndefined(vhostConfig.aliases)) {
            if (!_.isUndefined(vhostConfig.subdomains) && _.isBoolean(vhostConfig.subdomains)) {
              
              var fullVhost = _.join('.', 'www', vhostConfig.url);
                              
              function setupVhost(main, url, isAlias, subdomains) {
                // main full vhost
                var host      = _.join('.', 'www', url);
                var firstMsg  = (isAlias ? _.join(' ', '[ ', url, ' ] alias for main') : 'main');
                var secondMsg = (isAlias ? _.join(' ', '[ ', host, ' ] alias for main') : 'main');                
                
                logger.debug(_.join(' ', 'Adding', firstMsg, 'vhost', (isAlias ? main : url)));                               
                app.use(vhost(url, vhostapp));
                
                logger.debug(_.join(' ', 'Adding', secondMsg, 'vhost', (isAlias ? main : host)));
                app.use(vhost(host, vhostapp));
                
                // must process subdomains
                if (subdomains) {
                  var allSubDomains = _.join('.', '*', url);
                  logger.debug(_.join(' ', 'Subdomains is enabled. enable sub domains vhost for', allSubDomains));
                  app.use(vhost(allSubDomains, vhostapp));
                }                
              }
              
              // default vhost
              setupVhost(vhostConfig.url, vhostConfig.url, false, vhostConfig.subdomains);

              // process all aliased
              _.each(vhostConfig.aliases, function(vhosturl) {
                setupVhost(vhostConfig.url, vhosturl, true, vhostConfig.subdomains);
              });
              
              // setting up htaccess redirect. Check if property is ok
              if (_.has(vhostConfig, 'http')) {

                if (_.has(vhostConfig.http, 'redirect') && !_.isUndefined(vhostConfig.http.redirect)) {

                  var httpr = vhostConfig.http.redirect;
  
                  // default value
                  var fdRules = {
                    hostname : fullVhost,
                    port     : constants.PORT,
                  };
                  
                  // check if require property is valid
                  if (_.has(httpr, 'port') && _.has(httpr, 'url') && _.has(httpr, 'type')) {
                    if (_.isNumber(httpr.port) && !_.isNaN(httpr.port)) {
                      fdRules.port = httpr.port;
                    }
                    
                    if (!_.isNull(httpr.url) && !_.isEmpty(httpr.url)) {
                      fdRules.hostname = httpr.url;
                    }
                    
                    if (_.isNumber(httpr.type) && !_.isNaN(httpr.type)) {
                      _.extend(fdRules,  { type : httpr.type });
                    }

                    var fdomainMsg = _.join('', 'Setting up http redirect for current vhost  [ ', fdRules.hostname, ' ] on port : [ ', fdRules.port, ' ] for type : [ ', fdRules.type, ' ]');
  
                    if (_.has(fdRules, 'hostname') && !_.isNull(fdRules.hostname) && !_.isEmpty(fdRules.hostname) && _.has(fdRules, 'port') && _.has(fdRules, 'type') && _.isNumber(fdRules.type)) {
                      logger.debug(fdomainMsg);

                      // process redirect on for request                      
                      app.use(function(req, res, next) {
                        var r   = utils.getCorrectHost(req);
                        var rr  = _.join('://', req.protocol, fdRules.hostname);
                        var vr  = _.join('://', req.protocol, fullVhost);
                        
                        
                        // check if is different
                        if (r != vr && r != rr) {
                          logger.debug(_.join(' ', 'Redirect current domain', r, 'to the main domain', rr));
                          res.redirect(301, _.join('', rr, req.path));
                        } else {
                            // redirect is already done so process normal process
                            next();
                        }
                      });
                    }
                  }
                }                
              }
            }
          } 
        }        
      }
    }    
  }

  /**
   * Processing favicon
   */
  if (!(_.isUndefined(constants.ICONS_DIRECTORY))) {
    if (_.isString(constants.ICONS_DIRECTORY)) {
      
      var fav = _.join('/', constants.ICONS_DIRECTORY, 'favicon.ico');
      if (fs.existsSync(fav)) {
        logger.debug(_.join(' ', 'Adding favicon : ', fav)); 
        app.use(favicon(fav,  { maxAge : 2592000000 } ));
      } else {
        logger.warning(_.join(' ', "Favicon doesn't exist. Checking path [", fav, '] failed'));
      }
    }
  }
  
  /**
   * Setting up the static public directory
   */
  logger.debug(_.join(' ', 'Setting up static directory to [', constants.PUBLIC_DIRECTORY, ']'));
  app.use(express.static(constants.PUBLIC_DIRECTORY));

  /**
   * Setting up model conf
   */
  logger.debug(_.join(' ', 'Setting up views directory to [', constants.VIEWS_DIRECTORY, ']')); 
  app.set('views', constants.VIEWS_DIRECTORY);
  
  /**
   * Setting up view engine
   */
   if (!(_.isUndefined(eConfig))) {
     if (!(_.isUndefined(eConfig.viewEngine)) && _.isString(eConfig.viewEngine)) {
       logger.debug(_.join(' ', 'Setting up view engine to [', eConfig.viewEngine, ']'));
       app.set('view engine', eConfig.viewEngine);
     } else {
       logger.warning('View engine config is missing. Setting up default view engine to jade')
       app.set('view engine', 'jade');       
     }
   }
   logger.debug('Enable JSONP for express');
   app.enable('jsonp callback');

   /**
    * Setting up dependencies modules and routes
    */
    logger.debug('Setting up Cookie Parser middleware for current express app');
    app.use(cookieParser());    









    logger.debug('Setting up json middleware support for current express app');
    app.use(bodyParser.json({
      strict  : true,
      inflate : true,
      type    : 'json'      
    }));    

    logger.debug('Setting up urlencoded middleware support for current express app');
    app.use(bodyParser.urlencoded({
      extended  : true,
      inflate   : true,
      type      : 'urlencoded'      
    }));    

    logger.debug('Setting up method-override middleware support for current express app');
    app.use(methodOverride());

    if (!(_.isUndefined(eConfig))) {
      if (!(_.isUndefined(eConfig.session)) && _.isObject(eConfig.session)) {
        var eSession = eConfig.session;
        
         var eSessionOptions = {};
         
         if (!(_.isUndefined(eSession.secret)) && _.isString(eSession.secret)) {
           _.extend(eSessionOptions, { secret : eSession.secret });
         }

         if (!(_.isUndefined(eSession.name)) && _.isString(eSession.name)) {
           _.extend(eSessionOptions, { name : eSession.name });
         }         

         if (!(_.isUndefined(eSession.secure)) && _.isBoolean(eSession.secure)) {
           _.extend(eSessionOptions, { cookie : { secure : eSession.secure } });
         }         

         if (!(_.isUndefined(eSession.genuuid)) && _.isBoolean(eSession.genuuid)) {
           if (eSession.genuuid) {
              var gen = function(req) {
                return uuid.v4();
              };
                           
               _.extend(eSessionOptions, { genid : gen });                                
           }
         }
         
         if (!(_.isUndefined(eSession.resave)) && _.isBoolean(eSession.resave)) {
           _.extend(eSessionOptions, { resave : eSession.resave });
         }
         
         if (!(_.isUndefined(eSession.saveUninitialized)) && _.isBoolean(eSession.saveUninitialized)) {
           _.extend(eSessionOptions, { saveUninitialized : eSession.saveUninitialized });
         }         
         
         if (!(_.isEmpty(eSessionOptions)) && !(_.isUndefined(eSession.proxy)) && _.isBoolean(eSession.proxy)) {
           if (eSession.proxy) {
             logger.debug('Setting up proxy trust for session middleware to enable');
             app.set('trust proxy', 1);
           }
           
           logger.debug('Setting up expression session middleware support for current express app');
           app.use(session(eSessionOptions));
         }
      }
    }




    /**
     * Setting up Social rules
     */
    logger.debug('Setting up social rules => Facebook share for current express app');     
    app.use(function(req, res, next) {

      // for facebook
      var userAgent = req.headers['user-agent'];      

      // for seo
      var fragment  = req.query._escaped_fragment_;
      
      // Is Facebook ? 
      if (userAgent.indexOf('facebookexternalhit') >= 0) {
        // get current host
        var host = utils.getCorrectHost(req);

        // generate facebook share
        social.generateFacebookShare(host, req.url, function(data) {
          if (!_.isEmpty(data)) {
            render.render('social/facebook-share', req, res, next, { sharetitle : data.title, facebook : data.facebook });
          } else {
            social.generateDefaultShare(host, req.url, function(data) { 
              if (!_.isEmpty(data)) {
                render.render('social/facebook-share', req, res, next, { sharetitle : data.title, facebook : data.facebook });
              } else {
                return next();
              }
            }, 'facebook');          
          }
        });        
      } else {
        // comment all for the moment only for facebook SEO snapshots for later
        return next();
      }
    });



    /**
     * Setting up SEO rules
     */
    logger.debug('Setting up seo rules for html5 js app');     
    app.use(prerender);


    /**
     * Setting up multipart for upload
     */
    logger.debug('Setting up multipart support for current express app');
    app.use(multipart());
    
    /**
     * Setting up flash middleware
     */
    logger.debug('Setting up connect-flash middleware support for current express app');
    app.use(flash());

    /**
     * Setting up dynamic helpders
     */
    logger.debug(_.join(' ', 'Setting up dynamic helpers for express app with reference [', app.get('app_name'), ']'));
    app.use(helpers(app.get('app_name')));  

    /**
     * Setting up router
     */
    logger.debug('Setting up Router for current express app');    
    app.use(express.Router());
    
    logger.info('Express is ready to use ....')
};








































