/*******(╯°□°）╯︵ ┻━┻-----------TODO-----------┬──┬◡ﾉ(° -°ﾉ)***************/
/*
 * Functionality: 1. Connect to EC2 -- DONE
 *                2. Add increasing integer to track current page -- DONE
 *                3. Is there a way to handle repeated, quick navigations? DONE
 *                4. Research/add highlighting
 *                5. Write content script for highlighting
 *
 * Follow-up/polishing: 1. Robust code for initially connecting to server
 *                      2. Master/slave mode -- DONE
 *
 * Experiments: 1. Does it even funciton?
 *              2. How quickly can we send pings before it breaks?
 *              3. How much overhead is associated with the ping?
 * Future Goals:
 *              1. Multiple 'master' client management
 *              2. Democratic vote mode
 *              3. Set text in an HTML text box
 */
/*******(」゜ロ゜)」--------------------------------щ(゜ロ゜щ)**************/

var PING_INTERVAL = 5000;
// var CHROME_TAB_LOADED = "complete";
var MASTER_ID = "m";
var extensionOn = false;

var serverURL = undefined; // URL of remote server that forwards updates
var updateInflight = false; // Keeps track if a message is already in flight
var oldURL = undefined; //URL of the last page visited
var counter = 0; // Increasing counter that tracks if we're ahead of the server
var launchedTab = undefined; // Tab the extension was launched on
var ID = undefined; // ID of whether this server is a master or slave

var websites = ["http://www.google.com", "http://www.facebook.com", "http://en.wikipedia.org", "http://www.youtube.com", "http://www.yahoo.com", "http://www.cs.swarthmore.edu", "http://www.github.com", "http://www.linkedin.com", "chrome://extensions", "http://www.yennycheung.com"];
var website_index = 0;
var cyclingCurTab = undefined;
var website_count = 0;
var tripup_count = 0;
var EXPERIMENT_ITERATIONS = 40;

chrome.browserAction.onClicked.addListener(function(tab) {
  //Switches extension on/off
  extensionOn = !(extensionOn);

  //chrome.tabs.executeScript(null, {file: "content_script.js"});

  if (extensionOn) { 
    var inputAddr = initExtension();

    if (inputAddr != null) {
      console.log("Extension is on");
      runExtension();
    }
    else {
      extensionOn = false;
      console.log("Null URL entered. Extension turned off.");
    }
  }
  else {
    console.log("Extension is off.");
    stopExtension();
  } 

});

// TODO: FIX? - Sometimes URL updates to server are not sent and 
//              tripping occurs when this is evoked.
/* Attempts to catch when Chrome prerendering changes the ID of a tab, 
 * and updates launchedTab.
 */
chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId){
  // console.log("TAB WAS REPLACED");
  // console.log("launchedTab: " + launchedTab.toString());
  // console.log("removedTabId: " + removedTabId.toString());
  // console.log("addedTabId: " + addedTabId.toString());
  
  if(removedTabId == launchedTab){
    launchedTab = addedTabId;
  }
});

// Upon visit to new URL, tell server of new URL.
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  //console.log("ID: " + ID);
  //console.log("launchedTab: " + launchedTab);
  
  // Only send an update if the extension is on, we're a master, and we're on
  // the launched tab
  updateInflight = true; 
  if (extensionOn && (ID == MASTER_ID)) {
    chrome.tabs.query({'lastFocusedWindow': true, 'active': true}, 
      function(curTab) {

      // console.log(changeInfo);
      // console.log("Tab: " + tab.url);
      // console.log("OldURL: " + oldURL);
      // console.log("launchedTab: " + launchedTab.toString());
      // console.log("CURR TAB: " + curTab[0].id.toString());
      // Check for URL changes in current tab.
      if (curTab[0].id == launchedTab && 
            (changeInfo.url != undefined || tab.url != oldURL) ) {
        
        //updateInflight = true; 
        //Antiquated: Send request only once, when tab has completely loaded new URL.
        //if (changeInfo.status == CHROME_TAB_LOADED) {

          // Accounts for two ways URL updates are reflected in Chrome.
          if (changeInfo.url != undefined) {
            counter++;
            params = ["url=" + changeInfo.url, "counter=" + counter.toString()];
          }
          else if (tab.url != oldURL) {
            counter++;
            params = ["url=" + tab.url, "counter=" + counter.toString()];
          }

          sendRequest("URL_update", params, function(response) {
            if (response.success == true) {
              console.log("Server received updated URL.");
            }
            else {
              //TODO: IMPLEMENT - Resend request upon failure?
              console.log("Server did not receive updated URL.")
            }
            //updateInflight = false;
          });
        //}
      }
    });
  }
  updateInflight = false;
});


//TODO: Check user input for valid remote server URL.
/* initExtension -
 * Sets up connection to server, or returns null if cancelled
 * 
 * Sets the launchedTab variable which restricts the extension
 * to work only on the launchedTab
 * 
 * Sets the ID of the extension to be a master or slave
 * */
function initExtension() {

  var input = window.prompt("Please enter URL of server.", "Server URL");
  if (input == null) {
    return null;
  }

  chrome.tabs.query({'lastFocusedWindow': true, 'active': true}, 
    function(curTab) {
      launchedTab = curTab[0].id;
  });

  ID = window.prompt("Are you participating as a master (m) or slave (s)?");

  //TODO: Refactor - Is 'input' variable necessary?
  serverURL = input;
  return input;
}

// TODO: FIX - URL changes are only reflected if clients alternate changing URL.  
/* runExtension
 *
 * Main body of extension that executes pings to the server and updates
 * the local tab's URL.
 *
 * While the extension is on, it calls itself recursively, asynchronously using
 * setTimeout()
 */
function runExtension() {
  if (updateInflight == false) {
    sendRequest("ping", ["sender=masterClient"], function(response) {
      console.log("Server URL: " + response.curURL);
      if (updateInflight == false) {
        chrome.tabs.query({'lastFocusedWindow': true, 'active': true}, 
          function(curTab) {
            console.log("Current URL: " + curTab[0].url);
            console.log("Current tab: " + curTab[0].id);
            console.log("Launched tab: " + launchedTab);
            console.log("Counter: " + counter);
            console.log("Server's Counter: " + response.counter);
            // Three conditions: 1. prevent unnecessary reloading
            //                   2. Are we in the correct tab?
            //                   3. Are we ahead of the update?
            if((curTab[0].url != response.curURL) && 
                     (curTab[0].id == launchedTab) && 
                            (counter <= response.counter)){
              chrome.tabs.update(curTab[0].id, {'url': response.curURL},
                function(){});

              // We've caught up to the server, so set the counter to match
              // the server
              counter = response.counter;
            }
            oldURL = response.curURL;
            cyclingCurTab = curTab;
          });
      }
    });

    // TODO: Move this block into a testing library file?
    // EXPERIMENT:
    // Given website visit interval, cycle through array of websites 
    // and count websites visited before five trip-ups for 40 iterations.
    if (cyclingCurTab != undefined) {
        chrome.tabs.update(cyclingCurTab[0].id, 
            {'url': websites[website_index]}, function(){
              if (cyclingCurTab[0].url != serverURL) {
                  tripup_count++;  
                  console.log("Tripped-up Count: " + tripup_count);
              }
              else {
                  website_count++;
                  console.log("Current Website Count: " + website_count);
              }
              // Quit experiment at 5 trip-ups.
              if (tripup_count >= 5) {
                  console.log("Tripped-up Website Count: " + website_count);
                  stopExtension();
              }
            });
        if (website_index == EXPERIMENT_ITERATIONS) {
            console.log("Finished Website Count: " + website_count);
            stopExtension();
        }
        else {
            website_index++;
        }
    }
    //

      timerId = window.setTimeout(runExtension, PING_INTERVAL);
    }
}

// Clear out all of the stored globals
function stopExtension() {
  clearTimeout(timerId);
  serverURL = undefined;
  launchedTab = undefined;
  ID = undefined;
  // TODO: Reset client counters on turn-off. Server increments and overflows. 
  //      And if server counter has overflowed, then notify to reset extension?
  // counter = 0;
}

// TODO: HTTP Get or Http Post?
/* sendRequest - Sends a POST (GET?) request to server.
 * @param:
 *   action - A string representing the action server needs to respond to.
 *   params - List of strings to be added to GET request URL.
 *   callback - Callback function for server response.
 */
function sendRequest(action, params, callback) {
    var url = createURL(action, params);
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function() {
        if (xhr.readyState == 4 && xhr.status==200) {
          var data = JSON.parse(xhr.responseText);
          callback(data);
        }
    };
    xhr.open("POST", url, true);
    xhr.send();
}

/* createURL - Helper function to create a URL string.
 * @param:
 *   action - A string representing action server needs to respond to.
 *   params - List of strings to be added to GET request URL.
 * @return:
 *   url - A string representing the constructed URL.
 */
function createURL(action, params) {
  var url = serverURL;
  url += action;
  url += "?";
  for (i in params) {
    url += encodeURIComponent(params[i]);
    if (i != params.length-1) {
      url += "&";
    }
  }
  return url;
}
