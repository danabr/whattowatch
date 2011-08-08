/*
  This worker accepts messages containing a path into
  the github api, and returns the result of performing
  the api call as a json string.
*/

onmessage = function(e) {
  var path = e.data;
  var url = "https://api.github.com/" + path + "?callback=handleResponse";
  importScripts(url);
}

function handleResponse(json) {
  postMessage(JSON.stringify(json));
}
