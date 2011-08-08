/*
  Warning: This code is a mess and is expected to stay so.
*/

/*
  Interface for abstracting calls to the github api.
*/
var Github = function () {
  var workers = [];
  var currentWorker = 0;
  while(workers.length < 4) {
    workers.push(new Worker("callgithub.js"));
  }

  return {
    workers: workers,
    currentWorker: currentWorker,
    call: function(path, callback) { 
      var worker = this.workers[this.currentWorker];
      worker.onmessage = function(msg) {
        callback(JSON.parse(msg.data));
      };
      worker.postMessage(path);
      this.currentWorker = (this.currentWorker + 1) % this.workers.length;
    }
  };
}();

function init() {
  var state = {};
  state.form = document.getElementById("username_form");
  state.resultsDiv = document.getElementById("results");
  state.followingDiv = document.getElementById("following");
  state.timeTakenDiv = document.getElementById("time_taken");
  state.form.onsubmit = function() {
    state.followingDiv.innerHTML = "";
    state.timeTakenDiv.innerHTML = "";
    state.resultsDiv.innerHTML = "";
    if (state.form.username.value.length > 0) {
      state.form.submit.disabled = true;
      state.username = state.form.username.value;
      state.suggestions = {};
      state.startTime = new Date();
      makeBlacklist(state);
    } else {
      state.resultsDiv.innerHTML = "No username given";
    }
    return false;
  };
}

function makeBlacklist(state) {
  Github.call("users/" + state.username + "/watched", function(json) {
    if (json.meta.status === 404) {
      state.resultsDiv.appendChild(document.createTextNode("No such user"));
      lastStep(state);
    } else {
      state.blacklist = {};
      for (repoIndex in json.data) {
        state.blacklist[repoId(json.data[repoIndex])] = true;
      }
    }

    getStalkedCoders(state);
  });
}

function getStalkedCoders(state) {
  Github.call("users/" + state.username + "/following", function(json) {
    state.following = json.data; 
    state.followingDiv.innerHTML = 
      "Following " + state.following.length + " coders";
    if(state.following.length > 0) {
      countScores(state);
    } else {
      var text = state.username + " is not following anyone";
      state.resultsDiv.innerHTML = text; 
      lastStep(state);
    }
  });
}

function countScores(state) {
  var finished = 0;
  function addScoresFromWatchlist(watchlist) {
    for(var repoIndex in watchlist.data) {
      var repo = watchlist.data[repoIndex];
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

    finished += 1;
    // Last watchlist retrieved?
    if(finished == state.following.length) {
      presentResults(state);
    }
  }

  for(var coderIndex in state.following) {
    Github.call("users/" + state.following[coderIndex].login + "/watched",
            addScoresFromWatchlist);
  }
}

function presentResults(state) {
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

  var timeTaken = (new Date()) - state.startTime;
  state.timeTakenDiv.innerHTML = "Time taken: " + timeTaken + "ms";
  
  // Display repos
  // Structure stolen from opencode.us =)
  var reposDiv = document.createElement("div");
  for(var repoIndex in repos) {
    var repo = repos[repoIndex];
    var repoDiv = document.createElement("div");
    repoDiv.className = "repository";
    
    var repoNameDiv = document.createElement("div");
    repoNameDiv.className="name";
    var scoreSpan = document.createElement("span");
    scoreSpan.appendChild(document.createTextNode(repo.score));
    scoreSpan.className = "score";
    repoNameDiv.appendChild(scoreSpan);
    var repoAnchor = document.createElement("a");
    repoAnchor.href = repo.repo.html_url;
    repoAnchor.target = "_blank";
    repoAnchor.appendChild(document.createTextNode(repoId(repo.repo)));
    repoNameDiv.appendChild(repoAnchor);
    
    var repoDescDiv = document.createElement("div");
    repoDescDiv.className = "description";
    repoDescDiv.appendChild(document.createTextNode(repo.repo.description));
    
    repoDiv.appendChild(repoNameDiv);
    repoDiv.appendChild(repoDescDiv);
    reposDiv.appendChild(repoDiv);
  }
  state.resultsDiv.appendChild(reposDiv);
  
  lastStep(state);
}

function lastStep(state) {
  state.form.submit.disabled = false;
}

function repoId(repo) {
  return repo.owner.login + "/" + repo.name;
}
