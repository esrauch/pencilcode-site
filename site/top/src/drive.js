define(['jquery', 'editor-view'], function($, view) {

var CLIENT_ID = '670662678080-5t97i55st99j1guuuqc6ui9sp9nlj1bb.apps.googleusercontent.com';

var SCOPES = [
  // Note that have to request drive instead of drive.file so that the following flow works.
  // 1) Person A creates a document, ACLs it to person B, sends person B a link
  // 2) Person B clicks the link.
  // With the drive.file scope we cannot open the file unless the user
  // specifically clicks it from the Drive view.
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/drive.install'
];

var MIME_TYPE = 'text/x-pencilcode';

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
    gapi.client.load('drive', 'v2', ensureDriveAuthed.bind(null, true));
  } else {
    ensureDriveAuthed();
  }
};

var ensureDriveAuthed = function(immediate) {
  gapi.auth.authorize({
    'client_id': CLIENT_ID,
    'scope': SCOPES,
    'immediate': immediate
  }, function(authResult) {
    if (authResult && !authResult.error) {
      for(var i = 0; i < pendingCallbacks.length; ++i) {
        pendingCallbacks[i]();
      }
      pendingCallbacks = [];
    } else {
      if (immediate) {
	view.showDriveAuthDialog({callback: ensureDriveAuthed.bind(null, false)});
      } else {
	console.error('Failed to auth');
      }
    }
  });
};

var saveAsNewFile = function(sourceText, callback) {
  var path = '/upload/drive/v2/files';
  var method = 'POST';
  doDriveFileWrite(path, method, sourceText, callback);
};

var updateFile = function(fileId, sourceText, callback) {
  var path = '/upload/drive/v2/files/' + fileId;
  var method = 'PUT';
  doDriveFileWrite(path, method, sourceText, callback);
};

var doDriveFileWrite = function(path, method, sourceText, callback) {
  boundary = '-------314159265358979323846';
  delimiter = "\r\n--" + boundary + "\r\n";
  close_delim = "\r\n--" + boundary + "--";
  var metadata = {
    'title': 'Pencilcode document',
    'mimeType': MIME_TYPE
  };
  var base64Data = btoa(sourceText);
  var multipartRequestBody =
      delimiter +
      'Content-Type: application/json\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: ' + MIME_TYPE + '\r\n' +
      'Content-Transfer-Encoding: base64\r\n' +
      '\r\n' +
      base64Data +
      close_delim;

  var request = gapi.client.request({
      'path': path,
      'method': method,
      'params': {'uploadType': 'multipart'},
      'headers': {
        'Content-Type': 'multipart/mixed; boundary="' + boundary + '"'
      },
      'body': multipartRequestBody});

  // TODO: Wrap this callback to an appropriate object that
  // the callers expect.
  request.execute(callback);
};

var readFile = function(fileId, callback) {
  gapi.client.drive.files.get({
    'fileId': fileId
  }).execute(function(result) {
    console.log(result);
    if (!result.downloadUrl) {
      callback({error: 'Error getting download url'});
    }
    var accessToken = gapi.auth.getToken().access_token;
    $.ajax({
      url: result.downloadUrl,
      beforeSend: function(xhr) {
        xhr.setRequestHeader('Authorization', 'Bearer ' + accessToken);
      },
      success: function(text) {
        callback({'data': text, 'file': result.title});
      },
      fail: function() {
        callback({error: 'Error downloading file'});
      }
    });
  });
};

return {
  saveAsNewFile: function(sourceText, callback) {
    ensureDriveLoadedAndAuthed(saveAsNewFile.bind(null, sourceText, callback));
  },
  updateFile: function(fileId, sourceText, callback) {
    ensureDriveLoadedAndAuthed(updateFile.bind(null, fileId, sourceText, callback));
  },
  readFile: function(fileId, callback) {
    ensureDriveLoadedAndAuthed(readFile.bind(null, fileId, callback));
  }
};

});
