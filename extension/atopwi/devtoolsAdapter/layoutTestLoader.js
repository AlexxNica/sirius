var layoutTestLoader = {
  
  onMessageFromDevTools: function(details, sender, sendResponse) {
    console.log("layoutTestLoader.onMessageFromDevTools sender %o details: %o",sender, details);
    var method = details.method;
    if (method && this[method]) {
      sendResponse(
        this[method].apply(this, details.arguments)
      );
    } else {
      if(method)
        console.error("layoutTestLoader.onMessageFromDevTools no "+ method + " in ", this)
    }
  },
  
  loadLayoutTestController: function(scriptURL) {
    var elt = document.createElement('script');
    elt.src = scriptURL;
    document.body.appendChild(elt);
    return true;
  },

   //--------------------------------------------------------------------- 

  onWindowMessage: function(event) {
    console.log("layoutTestLoader.onWindowMessage "+event.data.method, event);
    chrome.extension.sendMessage(event.data, function(response) {
      if (chrome.extension.lastError) {
          console.error("layoutTestLoader failed to send to background:" + chrome.extension.lastError.message);
          return;
      }
      console.log("layoutTestLoader.onWindowMessage " + event.data.method +", sendMessage response ", response);
    })
  },

  addListeners: function() {
    //chrome.extension.onMessage.addListener(this.onMessageFromDevTools.bind(this));
    window.addEventListener('message', this.onWindowMessage.bind(this));
    console.log("addListeners complete");  
  }
};

layoutTestLoader.addListeners();

// At the of this script we will attempt to runTests()
var controllerURL = "chrome-extension://fkhgelnmojgnpahkeemhnbjndeeocehc/atopwi/devtoolsAdapter/layoutTestController.js"
layoutTestLoader.loadLayoutTestController(controllerURL);
console.log("loaded "+controllerURL);
