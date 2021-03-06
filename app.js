/**
 * Copyright 2014, 2015 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

var express = require('express'),
    app = express(),
	bodyParser = require("body-parser"), //L.R.
    errorhandler = require('errorhandler'),
    bluemix = require('./config/bluemix'),
  //  watson = require('ibm-watson'),
    path = require('path'),
    // environmental variable points to demo's json config file
    extend = require('util')._extend;

const LanguageTranslatorV3 = require("ibm-watson/language-translator/v3")
const SpeechToTextV1 = require("ibm-watson/speech-to-text/v1")
const TextToSpeechV1 = require("ibm-watson/text-to-speech/v1")
const {IamAuthenticator} = require("ibm-watson/auth")

// For local development, put username and password in config
// or store in your environment
var config = {
  version: 'v1',
  url: 'https://stream.watsonplatform.net/speech-to-text/api',
  username: '<Your User Name>',
  password: '<Your Password>'
};

// if bluemix credentials exists, then override local
var credentials = extend(config, bluemix.getServiceCreds('speech_to_text'));

//var authorization = watson.authorization(credentials);
const authorization = new IamAuthenticator(credentials);


// redirect to https if the app is not running locally
if (!!process.env.VCAP_SERVICES) {
  app.enable('trust proxy');
  app.use (function (req, res, next) {
    if (req.secure) {
      next();
    } 
    else {
      res.redirect('https://' + req.headers.host + req.url);
    }
  });
}

// Setup static public directory
app.use(express.static(path.join(__dirname , './public')));

// Get token from Watson using your credentials
app.get('/token', function(req, res) {
  authorization.getToken({url: credentials.url}, function(err, token) {
    if (err) {
      console.log('error:', err);
      res.status(err.code);
    }
    res.send(token);
  });
});

// L.R.
// ------------------------------- MT ---------------------------------
app.use(bodyParser.urlencoded({ extended: false }));

var mt_credentials = extend({
  url: 'https://gateway.watsonplatform.net/language-translator/api',
  username: '<Your User Name>',
  password: '<Your Password>',
  version: 'v2'
}, bluemix.getServiceCreds('language-translation')); // VCAP_SERVICES

//var language_translation = watson.language_translation(mt_credentials);
const language_translation = new LanguageTranslatorV3(mt_credentials);

app.post('/api/translate', function(req, res, next) {
  //console.log('/v2/translate');
  
  var params = extend({ 'X-WDC-PL-OPT-OUT': req.header('X-WDC-PL-OPT-OUT')}, req.body);
  //console.log(' ---> params == ' + JSON.stringify(params)); //L.R.
  
  language_translation.translate(params, function(err, models) {
  if (err)
    return next(err);
  else
    res.json(models);
  });
});
// ----------------------------------------------------------------------

// L.R.
// -------------------------------- TTS ---------------------------------
var tts_credentials = extend({
  url: 'https://stream.watsonplatform.net/text-to-speech/api',
  version: 'v1',
  username: '<Your User Name>',
  password: '<Your Password>',
}, bluemix.getServiceCreds('text_to_speech'));

// Create the service wrappers
//var textToSpeech = watson.text_to_speech(tts_credentials);
const textToSpeech = new TextToSpeechV1(tts_credentials);

app.get('/synthesize', function(req, res) {
  var transcript = textToSpeech.synthesize(req.query);
  transcript.on('response', function(response) {
    if (req.query.download) {
      response.headers['content-disposition'] = 'attachment; filename=transcript.ogg';
    }
  });
  transcript.on('error', function(error) {
    console.log('Synthesize error: ', error)
  });
  transcript.pipe(res);
});

// ----------------------------------------------------------------------

// Add error handling in dev
if (!process.env.VCAP_SERVICES) {
  app.use(errorhandler());
}
var port = process.env.VCAP_APP_PORT || 3000;
app.listen(port);
console.log('listening at:', port);