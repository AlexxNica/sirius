/*******************************************************************************
 * @license
 * Copyright (c) 2010, 2012 IBM Corporation and others 
 * All rights reserved. This program and the accompanying materials are made 
 * available under the terms of the Eclipse Public License v1.0 
 * (http://www.eclipse.org/legal/epl-v10.html), and the Eclipse Distribution 
 * License v1.0 (http://www.eclipse.org/org/documents/edl-v10.html). 
 * 
 * Contributors:
 * IBM Corporation - initial API and implementation
 *******************************************************************************/
 
/*global define window document */
/*jslint devel:true*/

define(['i18n!orion/search/nls/messages', 'require', 'dojo', 'dijit', 'orion/auth', 'orion/util', 'orion/searchUtils', 'dijit/form/Button', 'dijit/layout/BorderContainer', 'dijit/layout/ContentPane' ], function(messages, require, dojo, dijit, mAuth, mUtil, mSearchUtils){

	/**
	 * Creates a new search client.
	 * @param {Object} options The options object
	 * @param {orion.serviceregistry.ServiceRegistry} options.serviceRegistry The service registry
	 * @name orion.searchClient.Searcher
	 * @class Provides API for searching the workspace.
	 */
	function Searcher(options) {
		this.registry= options.serviceRegistry;
		this._commandService = options.commandService;
		this._fileService = options.fileService;
		if(!this._fileService){
			console.error("No file service on search client"); //$NON-NLS-0$
		}
	}
	Searcher.prototype = /**@lends orion.searchClient.Searcher.prototype*/ {
		/**
		 * Runs a search and displays the results under the given DOM node.
		 * @public
		 * @param {String} query URI of the query to run.
		 * @param {String} [excludeFile] URI of a file to exclude from the result listing.
		 * @param {Function(JSONObject)} Callback function that receives the results of the query.
		 */
		search: function(query, excludeFile, renderer) {
			var qObj = mSearchUtils.parseQueryStr(query);
			try {
				this._fileService.search(qObj.location, query).then(function(jsonData) {
					/**
					 * transforms the jsonData so that the result conforms to the same
					 * format as the favourites list. This way renderer implementation can
					 * be reused for both.
					 * jsonData.response.docs{ Name, Location, Directory, LineNumber }
					 */
					var transform = function(jsonData) {
						var transformed = [];
						for (var i=0; i < jsonData.response.docs.length; i++) {
							var hit = jsonData.response.docs[i];
							transformed.push({name: hit.Name, 
											  path: hit.Location, 
											  folderName: mSearchUtils.path2FolderName(hit.Path, hit.Name),
											  directory: hit.Directory, 
											  lineNumber: hit.LineNumber});
						}
						return transformed;
					};
					var token = jsonData.responseHeader.params.q;
					token= token.substring(token.indexOf("}")+1); //$NON-NLS-0$
					//remove field name if present
					token= token.substring(token.indexOf(":")+1); //$NON-NLS-0$
					renderer(transform(jsonData), token);
				}, function(error) {
					renderer(null, null, error);
				});
			}
			catch(error){
				this.registry.getService("orion.page.message").setErrorMessage(error);	 //$NON-NLS-0$
			}
		},
						
		handleError: function(response, resultsNode) {
			console.error(response);
			var errorText = document.createTextNode(response);
			dojo.place(errorText, resultsNode, "only"); //$NON-NLS-0$
			return response;
		},
		setLocationByMetaData: function(meta, useParentLocation){
			var locationName = "";
			var noneRootMeta = null;
			if(useParentLocation && meta && meta.Parents && meta.Parents.length > 0){
				if(useParentLocation.index === "last"){ //$NON-NLS-0$
					noneRootMeta = meta.Parents[meta.Parents.length-1];
				} else {
					noneRootMeta = meta.Parents[0];
				}
			} else if(meta &&  meta.Directory && meta.Location && meta.Parents){
				noneRootMeta = meta;
			} 
			if(noneRootMeta){
				this.setLocationByURL(noneRootMeta.Location);
				locationName = noneRootMeta.Name;
			} else if(meta){
				locationName = this._fileService.fileServiceName(meta && meta.Location);
			}
			var searchInputDom = dojo.byId("search"); //$NON-NLS-0$
			if(!locationName){
				locationName = "";
			}
			if(searchInputDom && searchInputDom.placeholder){
				searchInputDom.value = "";
				if(locationName.length > 23){
					searchInputDom.placeholder = messages["Search "] + locationName.substring(0, 20) + "..."; //$NON-NLS-1$
				} else {
					searchInputDom.placeholder = messages['Search '] + locationName;
				}
			}
			if(searchInputDom && searchInputDom.title){
				searchInputDom.title = messages["Type a keyword or wild card to search in "] + locationName;
			}
		},
		setLocationByURL: function(locationURL){
			this.location = locationURL;
		},
		/**
		 * Returns a query URL for a search.
		 * @param {String} query The text to search for, or null when searching purely on file name
		 * @param {String} [nameQuery] The name of a file to search for
		 * @param {String} [sort] The field to sort search results on. By default results will sort by path
		 * @param {Boolean} [skipLocation] If true, do not use the location property of the searcher. Use "" as the location instead.
		 */
		createSearchQuery: function(query, nameQuery, sort, skipLocation)  {
			if (!sort) {
				sort = "Path"; //$NON-NLS-0$
			}
			sort += " asc";//ascending sort order //$NON-NLS-0$
			if (nameQuery) {
				//assume implicit trailing wildcard if there isn't one already
				var wildcard= (/\*$/.test(nameQuery) ? "" : "*"); //$NON-NLS-0$
				return  mSearchUtils.generateSearchQuery({sort: sort,
					rows: 100,
					start: 0,
					searchStr: "NameLower:" + this._luceneEscape(nameQuery, true) + wildcard}); //$NON-NLS-0$
			}
			return  mSearchUtils.generateSearchQuery({sort: sort,
				rows: 40,
				start: 0,
				searchStr: this._luceneEscape(query, true),
				location: skipLocation ? "": this.location});
		},
		/**
		 * Escapes all characters in the string that require escaping in Lucene queries.
		 * See http://lucene.apache.org/java/2_4_0/queryparsersyntax.html#Escaping%20Special%20Characters
		 * The following characters need to be escaped in lucene queries: + - && || ! ( ) { } [ ] ^ " ~ * ? : \
		 * @param {String} input The string to perform escaping on
		 * @param {Boolean} [omitWildcards=false] If true, the * and ? characters will not be escaped.
		 * @private
		 */
		_luceneEscape: function(input, omitWildcards) {
			var output = "",
			    specialChars = "+-&|!(){}[]^\"~:\\" + (!omitWildcards ? "*?" : ""); //$NON-NLS-1$ //$NON-NLS-0$
			for (var i = 0; i < input.length; i++) {
				var c = input.charAt(i);
				if (specialChars.indexOf(c) >= 0) {
					output += '\\'; //$NON-NLS-0$
				}
				output += c;
			}
			return output;
		},

		//default search renderer until we factor this out completely
		defaultRenderer: {
	
			/**
			 * Create a renderer to display search results.
			 * @public
		     * @param {DOMNode} resultsNode Node under which results will be added.
			 * @param {String} [heading] the heading text (HTML), or null if none required
			 * @param {Function(DOMNode)} [onResultReady] If any results were found, this is called on the resultsNode.
			 * @param {Function(DOMNode)} [decorator] A function to be called that knows how to decorate each row in the result table
			 *   This function is passed a <td> element.
			 * @returns a render function.
			 */
			makeRenderFunction: function(resultsNode, heading, onResultReady, decorator) {
				
				/**
				 * Displays links to resources under the given DOM node.
				 * @param [{name, path, lineNumber, directory, isExternalResource}] resources array of resources.  
				 *	Both directory and isExternalResource cannot be true at the same time.
				 * @param {String} [queryName] A human readable name to display when there are no matches.  If 
				 *  not used, then there is nothing displayed for no matches
				 * @param {String} [error] A human readable error to display.
				 */
				function render(resources, queryName, error) {
					if (error) {
						dojo.place("<div>"+messages["Search failed."]+"</div>", resultsNode, "only"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-0$
						if (typeof(onResultReady) === "function") { //$NON-NLS-0$
							onResultReady(resultsNode);
						}
						return;
					} 
				
					//Helper function to append a path String to the end of a search result dom node 
					var appendPath = (function() { 
					
						//Map to track the names we have already seen. If the name is a key in the map, it means
						//we have seen it already. Optionally, the value associated to the key may be a function' 
						//containing some deferred work we need to do if we see the same name again.
						var namesSeenMap = {};
						
						function doAppend(domElement, resource) {
							var path = resource.folderName ? resource.folderName : resource.path;
							var pathNode = document.createElement('span'); //$NON-NLS-0$
							pathNode.id = path.replace(/[^a-zA-Z0-9_\.:\-]/g,'');
							pathNode.appendChild(document.createTextNode(' - ' + path + ' ')); //$NON-NLS-1$ //$NON-NLS-0$
							domElement.appendChild(pathNode);
						}
						
						function appendPath(domElement, resource) {
							var name = resource.name;
							if (namesSeenMap.hasOwnProperty(name)) {
								//Seen the name before
								doAppend(domElement, resource);
								var deferred = namesSeenMap[name];
								if (typeof(deferred)==='function') { //$NON-NLS-0$
									//We have seen the name before, but prior element left some deferred processing
									namesSeenMap[name] = null;
									deferred();
								}
							} else {
								//Not seen before, so, if we see it again in future we must append the path
								namesSeenMap[name] = function() { doAppend(domElement, resource); };
							}
						}
						return appendPath;
					}()); //End of appendPath function
		
					var foundValidHit = false;
					dojo.empty(resultsNode);
					if (resources && resources.length > 0) {
						var table = document.createElement('table'); //$NON-NLS-0$
						table.setAttribute('role', 'presentation'); //$NON-NLS-1$ //$NON-NLS-0$
						for (var i=0; i < resources.length; i++) {
							var resource = resources[i];
							var col;
							if (!foundValidHit) {
								foundValidHit = true;
								if (heading) {
									var headingRow = table.insertRow(0);
									col = headingRow.insertCell(0);
									col.innerHTML = heading;
								}
							}
							var row = table.insertRow(-1);
							col = row.insertCell(0);
							col.colspan = 2;
							if (decorator) {
								decorator(col);
							}
							var resourceLink = document.createElement('a'); //$NON-NLS-0$
							dojo.place(document.createTextNode(resource.name), resourceLink);
							if (resource.LineNumber) { // FIXME LineNumber === 0 
								dojo.place(document.createTextNode(' (Line ' + resource.LineNumber + ')'), resourceLink); //$NON-NLS-1$ //$NON-NLS-0$
							}
							var loc = resource.location;
							if (resource.isExternalResource) {
								// should open link in new tab, but for now, follow the behavior of navoutliner.js
								loc = resource.path;
							} else {
								loc	= resource.directory ? 
										require.toUrl("navigate/table.html") + "#" + resource.path :  //$NON-NLS-1$ //$NON-NLS-0$
										require.toUrl("edit/edit.html") + "#" + resource.path; //$NON-NLS-1$ //$NON-NLS-0$
								if (loc === "#") { //$NON-NLS-0$
									loc = "";
								}
							}
		
							resourceLink.setAttribute('href', loc); //$NON-NLS-0$
							resourceLink.setAttribute('aria-describedby', (resource.folderName ? resource.folderName : resource.path).replace(/[^a-zA-Z0-9_\.:\-]/g,'')); //$NON-NLS-0$
							dojo.style(resourceLink, "verticalAlign", "middle"); //$NON-NLS-1$ //$NON-NLS-0$
							col.appendChild(resourceLink);
							appendPath(col, resource);
						}
						dojo.place(table, resultsNode, "last"); //$NON-NLS-0$
						if (typeof(onResultReady) === "function") { //$NON-NLS-0$
							onResultReady(resultsNode);
						}
					}
					if (!foundValidHit) {
						// only display no matches found if we have a proper name
						if (queryName) {
							var div = dojo.place("<div>"+messages["No matches found for "]+"</div>", resultsNode, "only"); //$NON-NLS-3$ //$NON-NLS-2$ //$NON-NLS-0$
							var b = dojo.create("b", null, div, "last"); //$NON-NLS-1$ //$NON-NLS-0$
							dojo.place(document.createTextNode(queryName), b, "only"); //$NON-NLS-0$
							if (typeof(onResultReady) === "function") { //$NON-NLS-0$
								onResultReady(resultsNode);
							}
						}
					} 
				}
				return render;
			}//end makeRenderFunction
		}//end defaultRenderer
	};
	Searcher.prototype.constructor = Searcher;
	//return module exports
	return {Searcher:Searcher};
});
