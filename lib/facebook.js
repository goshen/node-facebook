//////////////////////////////////////////////////////////////////////////////
//
//  Facebook Node.js SDK
//
//  Copyright 2011 Daniel Gasienica <daniel@gasienica.ch>
//  Copyright 2010 Facebook
//
//  Licensed under the Apache License, Version 2.0 (the "License"); you may
//  not use this file except in compliance with the License. You may obtain
//  a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
//  Unless required by applicable law or agreed to in writing, software
//  distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
//  WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
//  License for the specific language governing permissions and limitations
//  under the License.
//
//////////////////////////////////////////////////////////////////////////////

var hashlib = require('hashlib');
var https = require('https');
var querystring = require('querystring');


var GraphAPI = exports.GraphAPI = module.exports.GraphAPI = function (accessToken) {
    this.accessToken = accessToken;
};

GraphAPI.prototype.getObject = function (id, args, callback) {
    if (typeof args == 'function') {
        return this.request('/' + id, 'GET', null, null, args);
    }
    return this.request('/' + id, 'GET', args, null, callback);
};

GraphAPI.prototype.getObjects = function (ids, args, callback) {
    args['ids'] = ids.join(',');
    return this.request('/', 'GET', args, null, callback);
};

GraphAPI.prototype.getConnections = function (id, connectionName, args, callback) {
    if (typeof args == 'function') {
        return this.request('/' + id + '/' + connectionName, 'GET', null, null, args);
    }
    return this.request('/' + id + '/' + connectionName, 'GET', args, null, callback);
};

GraphAPI.prototype.putObject = function (parentObject, connectionName, data, callback) {
    return this.request(parentObject + '/' + connectionName, 'POST', null, data, callback);
};

GraphAPI.prototype.putWallPost = function (message, attachment, profileId, callback) {
    var attachment = attachment || {};
    var profileId = profileId || 'me';
    var data = {
        message: message,
        attachment: attachment
    };
    return this.putObject(profileId, 'feed', data, callback);
};

GraphAPI.prototype.putLike = function (objectId, callback) {
    return this.putObject(objectId, 'likes', callback);
};

GraphAPI.prototype.putComment = function (objectId, message, callback) {
    return this.putObject(objectId, 'comments', {message: message}, 'likes', callback);
};

GraphAPI.prototype.deleteObject = function (id, callback) {
    return this.request('/' + id, 'DELETE', null, null, callback);
};

GraphAPI.prototype.request = function (path, method, args, postArgs, callback) {
    var method = method || 'GET';
    var args = args || {};

    if (this.accessToken) {
        if (postArgs) {
            postArgs['access_token'] = this.accessToken;
        } else {
            args['access_token'] = this.accessToken;
        }
    }

    if (path !== '/') {
        path = '/' + path;
    }

    var path = path + '?' + querystring.stringify(args);
    var postData = postArgs ? querystring.stringify(postArgs) : null;

    if (postData) {
        method = 'POST';
    }

    var options = {
        host: 'graph.facebook.com',
        port: 443,
        method: method,
        path: path,
        headers: {
            'Accept': 'application/json'
        }
    };

    var request = https.request(options, function (res) {
        res.setEncoding('utf8');
        var body = [];
        res.on('data', function (chunk) {
            body.push(chunk);
        });
        res.on('end', function () {
            var data;
            var error;
            try {
                data = JSON.parse(body.join(''));
            } catch(e) {
                data = null;
                error = e;
            }
            if (data && data.error) {
                // Graph API error
                callback(data.error, null);
            } else if (data) {
                // success
                callback(null, data);
            } else {
                // error
                callback(error, null);
            }
        });
    });

    request.on('error', function (error) {
        callback(error, null);
    });

    if (postData) {
        request.write(postData);
    }

    request.end();
};


exports.getSessionFromCookie = function (cookies, appId, appSecret) {
    // read Facebook application cookie
    var cookie = cookies['fbs_' + appId];
    if (cookie) {
        // strip double quotes from beginning and end
        cookie = cookie.replace(/^"/, '').replace(/"$/, '');
    } else {
        return null;
    }

    var session = querystring.parse(cookie);
    var expires = parseInt(session['expires'], 10);

    // assemble payload (alphabetical)
    var keys = Object.keys(session).sort();
    // remove sig key
    keys = keys.filter(function (element, index, array) {
        return element !== 'sig';
    })
    var payload = '';
    keys.forEach(function (key, index, array) {
        payload +=  key + '=' + session[key];
    });

    // compute signature
    var sig = hashlib.md5(payload + appSecret);

    // timestamp in seconds
    var now = Date.now() / 1000;

    // validate signature
    if (sig === session['sig'] && (expires === 0 || now < expires)) {
        return session;
    }

    return null;
};

exports.getUserFromCookie = function (cookies, appId, appSecret) {
    var session = this.getSessionFromCookie(cookies, appId, appSecret);
    if (session) {
        var user =  {
            'access_token': session['access_token'],
            'uid': session['uid']
        };
        return user;
    }
    return null;
};
