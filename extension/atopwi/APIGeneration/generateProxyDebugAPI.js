
var generateProxyDebugAPI = {

// Modified copy of InspectorBackend.js  loadFromJSONIfNeeded()

    loadInspectorJSON: function(inspectorJSONUrl)
    {
        if (this._initialized)
            return;

        var xhr = new XMLHttpRequest();
        xhr.open("GET", inspectorJSONUrl, false);
        xhr.send(null);
    
        var schema = JSON.parse(xhr.responseText);
        var jsTypes = { integer: "number", array: "object" };
        var rawTypes = {};
    
        var domains = schema["domains"];
        for (var i = 0; i < domains.length; ++i) {
            var domain = domains[i];
            for (var j = 0; domain.types && j < domain.types.length; ++j) {
                var type = domain.types[j];
                rawTypes[domain.domain + "." + type.id] = jsTypes[type.type] || type.type;
            }
        }
    
        var result = [];
        var version = schema.version.major + '.' +schema.version.minor;
        result.push("/* Machine generated from "+inspectorJSONUrl+' version: '+version+" on "+new Date()+" */\n");
        result.push('(function () {');
        result.push('var chrome = chrome || {};');
        result.push('chrome.devtools = chrome.devtools || {};');
        result.push('chrome.devtools.proxy = chrome.devtools.proxy || {};');
        result.push("chrome.devtools.proxy.version = "+version+';\n');
        
        for (var i = 0; i < domains.length; ++i) {
            var domain = domains[i];
            var unsupported = domain.hidden ? '/* unsupported */ ' : '';
            result.push(unsupported+"\nchrome.devtools.proxy." + domain.domain + ' = {};');
            result.push('chrome.devtools.proxy.' + domain.domain + '.prototype = {');
            
            result.push("\n    // Commands: ");
            var commands = domain["commands"] || [];    
            for (var j = 0; j < commands.length; ++j) {
                var command = commands[j];
                var parameters = command["parameters"];
                var paramsText = [];
                for (var k = 0; parameters && k < parameters.length; ++k) {
                    var parameter = parameters[k];
    
                    var type;
                    if (parameter.type)
                        type = jsTypes[parameter.type] || parameter.type;
                    else {
                        var ref = parameter["$ref"];
                        if (ref.indexOf(".") !== -1)
                            type = rawTypes[ref];
                        else
                            type = rawTypes[domain.domain + "." + ref];
                    }
    
                    var text = parameter.name;
                    paramsText.push(text);
                }
                
                var returnsText = [];
                var returns = command["returns"] || [];
                for (var k = 0; k < returns.length; ++k) {
                    var parameter = returns[k];
                    returnsText.push( parameter.name );
                }
                
                var returnsString = "";
                if (returnsText.length) {
                  returnsString ="/*("+ returnsText.join(',')+")*/";
                }
                
                paramsText.push('opt_callback'+returnsString);
                
                var unsupported = command.hidden ? '/* unsupported */ ' : '';
                
                result.push('    '+unsupported+command.name+': function('+paramsText.join(', ')+') {');
                paramsText.pop();  // don't serialize the callback
                result.push('        var paramObject = {');
                paramsText.forEach(function(param) {
                  result.push('             \'' + param + '\': ' + param +',');
                });
                result.push('         };');
                result.push('        chrome.devtools.proxy.sendCommand(\'' + domain.domain + '\', \'' + command.name + '\', paramObject, opt_callback);');
                result.push('    },');
            }
            if (domain.events && domain.events.length) {
                result.push('\n    // Event handlers to override, then call initialize');
                var eventRegistrations = [];
                for (var j = 0; domain.events && j < domain.events.length; ++j) {
                    var event = domain.events[j];
                    var paramsText = [];
                    for (var k = 0; event.parameters && k < event.parameters.length; ++k) {
                        var parameter = event.parameters[k];
                        paramsText.push(parameter.name);
                    }
                    var unsupported = event.hidden ? '/* unsupported */ ' : '';
                    result.push('    '+unsupported+event.name + ": function(" + paramsText.join(", ") + ") {},");
                    
                    eventRegistrations.push('        chrome.devtools.proxy.registerEvent(');
                    eventRegistrations.push('            \''+domain.domain + '\', ');
                    eventRegistrations.push('            \''+event.name + '\', ');
                    eventRegistrations.push('            [\'' + paramsText.join('\', \'') + '\']);');
                }
                result.push('\n    // Call in your constructor to register for this events in domain');
                result.push('    initialize: function() {');
                result.push('        chrome.devtools.proxy.onEvent(\'' + domain.domain + '\', this);');
                result = result.concat(eventRegistrations);
                result.push('    },');
            }
            
            result.push("};\n");
        }
        result.push("return chrome.devtools.proxy;\n");
        
        result.push("/* copyright 2011 Google, inc. johnjbarton@google.com Google BSD License */");
        result.push("/* See https://github.com/johnjbarton/atopwi/blob/master/APIGeneration/generateRemoteDebugAPI.html */");
        result.push("}());\n");
        
        return (result.join('\n'));
    }
};
