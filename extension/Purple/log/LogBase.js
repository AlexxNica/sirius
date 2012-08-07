// Google BSD license http://code.google.com/google_bsd_license.html
// Copyright 2011 Google Inc. johnjbarton@google.com

/*globals define console */

define(['MetaObject/MetaObject', 'log/SparseArray'], 
function (          MetaObject,        SparseArray){
  
var LogBase = MetaObject.extend({
    
  initialize: function(clock, name) {
    this.clock = clock;
    this.store = SparseArray.new(name);
  },
  
  connect: function(hasEnableDisable) {
    this.hasEnableDisable = hasEnableDisable;
  },
  
  disconnect: function() {
    delete this.hasEnableDisable;
  },
  
  post: function(data) {
    this.store.set(this.clock.p_id++, data);
  },
 
  // Input Management

  getHasEnableDisable: function() {
    if (!this.hasEnableDisable) {
      throw new Error("Connect before using remote category");
    }
    return this.hasEnableDisable;
  },
  
  broadcastEnabled: function() {
    this.toEachListener({type: 'logEnable', enabled: this.enabled});
  },
  
  toggleEnable: function() {
    throw new Error("unimplemented")
  },
  
  return LogBase;
});

