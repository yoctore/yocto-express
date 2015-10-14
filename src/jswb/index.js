'use strict';

var logger  = require('yocto-logger');
var uuid    = require('uuid');
var fs      = require('fs');
var path    = require('path');
var jwt     = require('jsonwebtoken');
var _       = require('lodash');

function Jswb (logger) {

  /**
   * Default logger instance
   * 
   * @property logger
   * @type Object
   */
  this.logger           = logger;

  /**
   * Default encrypt key
   *
   * @property encryptKey
   * @type {String}
   */
  this.enryptKey = uuid.v4();

  /**
   * Default algorithms list
   *
   * @property algorithms
   * @type {Array}
   */
  this.algorithms = [ 'HS256', 'HS384', 'HS512', 'RS256',
                      'RS384', 'RS512', 'ES256', 'ES384', 'ES512' ];

  /**
   * Default algorithm
   *
   * @property algorithm
   * @type {String}
   * @default HS256
   */
  this.algorithm    = 'HS256'
}

/**
 * Set or get algo to use
 *
 * @param {String} value algo to use
 * @return {String} default algo to use
 */
Jswb.prototype.algorithm = function (value) {

  if (_.isString(value) && _.includes(this.algorithms, value)) {
    // set given value
    this.algorithm = value;
    // message
    this.logger.info([ '[ Jswb.algorithm ] - set algorithm to', value ].join(' '));
  } else {
    // message
    this.logger.warning([ '[ Jswb.algorithm ] - invalid algorithm given. Keep algo to',
                          this.algorithm
                        ].join(' '));
  }

  // default statement
  return this.algorithm;
};

/**
 * Default function to set encryption key
 *
 * @param {String} keyOrPath key or path to use for encryption
 * @param {Boolean} file, set to true if given key is a file for content reading
 * @return {Boolean} true if all is ok false otherwise
 */
Jswb.prototype.setKey = function (keyOrPath, file) {
  // set default for is file check
  file = _.isBoolean(file) ? file : false;

  // is string ?
  if (_.isString(keyOrPath) && !_.isEmpty(keyOrPath)) {
    // is file
    if (file) {
      // is relative ?
      if (!path.isAbsolute(keyOrPath)) {
        // normalize path
        keyOrPath = path.normalize([ process.cwd(), keyOrPath ].join('/'));
      }
      // process file process
      keyOrPath = fs.readFileSync(keyOrPath);
    }

    // set value
    this.enryptKey = keyOrPath;
    // message
    this.logger.info('[ Jswb.setKey ] - Setting key done.');
    // valid statement
    return _.isString(this.enryptKey) && !_.isEmpty(this.enryptKey);
  } else {
    // warning message invalid key
    this.logger.warning('[ Jswb.setKey ] - Invalid key or path given.');
  }

  // invalid statement
  return false;
};

/**
 * Check signature of given object
 *
 * @param {Object} data data to verify
 * @return {Object} default promise
 */
Jswb.prototype.verify = function (data) {
  // save context
  var context   = this;
  // create async process
  var deferred  = Q.defer();

  // check signature
  jwt.verify(data, this.encryptKey, function (err, decoded) {
    // has error ?
    if (err) {
      // log error
      context.logger.error([ '[ Jswb.verify ] -', err.message, err.expiredAt || '' ].join(' '));
      // reject verify is invalid
      deferred.reject(err);
    } else {
      // ok so resolve 
      deferred.resolve(decoded);
    }
  });

  // default promise
  return deferred.promise;
};

/**
 * Sign data from given key
 *
 * @param {Object} data data to verify
 * @return {String} signed data
 */
Jswb.prototype.sign = function (data, options) {
  // default options object
  options  = options || {};
  // has algo rules defined ?
  if (!_.has(options, 'algorithm')) {

    // merge algo
    if (!_.includes(this.algorithms, options.algorithm)) {
      // merge with current algo
      _.merge(options, { algorithm : this.algorithm() });
    }
  }

  // return sign data
  return jwt.sign(data, this.encryptKey, options);
};

/**
 * Decode data without signature verification
 *
 * @param {Object} data data to verify
 * @return {String} signed data
 */
Jswb.prototype.decode = function (data) {
  // return sign data
  return jwt.sign(data);
};

// Default export
module.exports = function (c, l) {
  // is a valid logger ?
  if (_.isUndefined(l) || _.isNull(l)) {
    logger.warning('[ Jswb.constructor ] - Invalid logger given. Use internal logger');
    // assign
    l = logger;
  }

  // default statement
  return new (Jswb)(l);
};