![alt text](https://david-dm.org/yoctore/yocto-express.svg "Dependencies Status")
[![Code Climate](https://codeclimate.com/github/yoctore/yocto-express/badges/gpa.svg)](https://codeclimate.com/github/yoctore/yocto-express)
[![Test Coverage](https://codeclimate.com/github/yoctore/yocto-express/badges/coverage.svg)](https://codeclimate.com/github/yoctore/yocto-express/coverage)
[![Issue Count](https://codeclimate.com/github/yoctore/yocto-express/badges/issue_count.svg)](https://codeclimate.com/github/yoctore/yocto-express)
[![Build Status](https://travis-ci.org/yoctore/yocto-express.svg?branch=master)](https://travis-ci.org/yoctore/yocto-express)

## Overview

This module is a part of yocto node modules for NodeJS.

Please see [our NPM repository](https://www.npmjs.com/~yocto) for complete list of available tools (completed day after day).

This module manage set up for an express app based on [yocto-config](https://www.npmjs.com/package/yocto-config) package

**!!! IMPORTANT !!! Please read [yocto-config](https://www.npmjs.com/package/yocto-config) readme before any usage** 

## Motivation

Create an automatic an ready to use set up for express from [yocto-config](https://www.npmjs.com/package/yocto-config) package.

## How to use

1. Set up your config files [Example Here](https://www.npmjs.com/package/yocto-config#how-to-use)
2. Set up your app. See example below : 

```javascript
var logger    = require('yocto-logger');
var config    = require('yocto-config')(logger);

// YOUR CONFIG PROCESS HERE

var e         = require('yocto-express')(config, logger);

// Set a directory if your want
e.useDirectory('MY_DIRECTORY_ONE', '/foo');
// Set a directory again
e.useDirectory('MY_DIRECTORY_TWO', '/bar');

// process configure
e.configure().then(function (success) {
  // normal process
}).catch(function (error) {
  // an error so bad 
});
```

## If i didn't want configure yocto-config ?

You can also do this. But yocto-express will be initialized his internal config from your `process.cwd` current path,
so config file must be defined on it.

```javascript
var logger    = require('yocto-logger');
var config    = require('yocto-config')(logger); // OR YOU CAN SET CONFIG TO NULL

// DO NOT CONFIG

var e         = require('yocto-express')(config, logger);

// EXTRA CODE
```

## Next Step

- Add passportJS on current app
- Add Vhost usage & more

## Changelog

All history is [here](https://github.com/yoctore/yocto-express/blob/master/CHANGELOG.md)