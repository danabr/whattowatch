// Global state
var state = {};

function init() {
  var form = document.getElementById("username_form");
  var resultsDiv = document.getElementById("results");
  form.username.focus();
  form.onsubmit = function() {
    state.resultsDiv = resultsDiv;
    state.form = form;
    clear(resultsDiv);
    if (form.username.value.length > 0) {
      state.username = form.username.value;
      form.submit.disabled = true;
      stepOne();
    } else {
      resultsDiv.appendChild(document.createTextNode("No username given"));
    }
    return false;
  };
}

function callGithub(path, callback) {
  var url = "https://api.github.com/" + path + "?callback=" + callback;
  var script = document.createElement("script");
  script.src = url;
  document.head.appendChild(script);
}

function clear(container) {
  while(container.firstChild) {
    container.removeChild(container.firstChild);
  }
}

function stepOne() {
  state.suggestions = {};
  callGithub("users/" + state.username + "/watched", "stepTwo");
}

// Create blacklist
function stepTwo(json) {
  if (json.meta.status === 404) {
    state.resultsDiv.appendChild(document.createTextNode("No such user"));
    lastStep();
  } else {
    state.blacklist = {};
    for (repoIndex in json.data) {
      state.blacklist[repoId(json.data[repoIndex])] = true;
    }
  }
  // Get a list of people *username* is following
  callGithub("users/" + state.username + "/following", "stepThree");
}

// Following
function stepThree(json) {
  state.following = json.data;
  if (state.following.length > 0) {
    state.followIndex = 1;
    callGithub("users/" + json.data[0].login + "/watched",
               "stepFour");
  } else {
    var text = state.username + " is not following anyone";
    state.resultsDiv.appendChild(document.createTextNode(text));
    lastStep();
  }
}

// Find out what those people are watching
function stepFour(json) {
  for(var repoIndex in json.data) {
    var repo = json.data[repoIndex];
    var id = repoId(repo);
    if (state.blacklist[id] === undefined) {
      if (state.suggestions[id] === undefined) {
        state.suggestions[id] = {
          repo: repo,
          score: 1
        }
      } else {
        state.suggestions[id].score += 1;
      }
    }
  }
  // Continue with the rest of the people *username* is following
  if (state.followIndex < state.following.length) {
    state.followIndex += 1;
    callGithub("users/" + state.following[state.followIndex-1].login + 
                "/watched", "stepFour");
  } else {
    stepFive();
  }
}

function stepFive() {
  // state.suggestions now contains all suggestions.
  // Now we sort the suggestions and present them to the user.
  var repos = [];
  for (var repoName in state.suggestions) {
    repos.push(state.suggestions[repoName]);
  }
  
  repos.sort(function (a, b) {
    if (a.score < b.score) {
      return 1;
    } else {
      return -1;
    }
  });
  
  // Display repos
  var table = document.createElement("table");
  for(var repoIndex in repos) {
    var repo = repos[repoIndex];
    var tr = document.createElement("tr");
    var idTd = document.createElement("td");
    var idA = document.createElement("a");
    idA.href = repo.repo.html_url;
    idA.appendChild(document.createTextNode(repoId(repo.repo)));
    idTd.appendChild(idA);
    var scoreTd = document.createElement("td");
    scoreTd.appendChild(document.createTextNode(repo.score));
    tr.appendChild(idTd);
    tr.appendChild(scoreTd);
    table.appendChild(tr);
  }
  state.resultsDiv.appendChild(table);
  
  lastStep();
}

function lastStep() {
  state.form.submit.disabled = false;
  
  // Clean up state
  for (var property in state) {
    delete state.property;
  }
  // Remove script tags
  var headNodes = document.head.childNodes;
  var i = headNodes.length;
  var github = /github/;
  while(--i) {
    if (headNodes[i].tagName === "SCRIPT" &&
        github.test(headNodes[i].src)) {
      document.head.removeChild(headNodes[i]);
    }
  }
}

function repoId(repo) {
  return repo.owner.login + "/" + repo.name;
}
