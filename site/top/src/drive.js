define(['jquery'], function($) {

var CLIENT_ID = '670662678080-5t97i55st99j1guuuqc6ui9sp9nlj1bb.apps.googleusercontent.com';

var SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.install'
];

// The callback name cannot be namespaced.
var GAPI_JS_URL = "https://apis.google.com/js/client.js?onload=ensureDriveLoaded";

var pendingCallbacks = [];

var ensureDriveLoadedAndAuthed = function(callback) {
  // TODO(esrauch): Gracefully handling multiple callbacks here.
  if (pendingCallbacks.length > 0) {
    console.error('Already had a pending callback');
    return;
  }
  pendingCallbacks.push(callback);
  if (!window.gapi || !gapi.client) {
    var script = document.createElement('script');
    script.src = GAPI_JS_URL;
    document.body.appendChild(script);
  } else {
    ensureDriveLoaded();
  }
}

window.ensureDriveLoaded = function() {
  if (!gapi.client.drive) {
    gapi.client.load('drive', 'v2', ensureDriveAuthed);
  } else {
    ensureDriveAuthed();
  }
};

var ensureDriveAuthed = function() {
  gapi.auth.authorize({
    'client_id': CLIENT_ID,
    'scope': SCOPES,
    'immediate': 'true'
  }, function(authResult) {
    if (authResult && !authResult.error) {
      for(var i = 0; i < pendingCallbacks.length; ++i) {
        pendingCallbacks[i]();
      }
    } else {
      console.error('Failed to auth');
    }
  });
};

var saveAsNewFile = function(sourceText) {
  gapi.client.drive.files.insert({
    'resource': {
      'mimeType': MIME_TYPE,
      'title': 'Untitled Pencilcode'
    }
  }).execute(function(result) {
    window.console.log('Created', result);
  });
};

var readFile = function(fileId, callback) {
  gapi.client.drive.files.get({
    'fileId': fileId
  }).execute(function(result) {
    if (!result.downloadUrl) {
      callback({error: 'Error getting download url'});
    }
    var accessToken = gapi.auth.getToken().access_token;
    $.ajax({
      url: result.downloadUrl,
      beforeSend: function(xhr) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken)
      },
      success: function(text) {
        callback({'data': text});
      },
      fail: function() {
        callback({error: 'Error downloading file'});
      }
    });
  });
};

return {
  saveAsNewFile: function(sourceText, callback) {
    ensureDriveLoadedAndAuthed(saveAs.bind(null, sourceText, callback));
  },
  readFile: function(fileId, callback) {
    ensureDriveLoadedAndAuthed(readFile.bind(null, fileId, callback));
  }
};

});
