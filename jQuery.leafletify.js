/**
*	Leafletify - jQuery plugin to plot points on a map using Leaflet.js (http://leafletjs.com)
*
*	Copyright (c) 2013 Rob Huzzey
*
*	Version 1.0
*
*	Project Home:
*		https://github.com/robhuzzey/leafletify
*
*
*	Options:
*		All the same options as Leafletify has: http://leafletjs.com/reference.html#map-l.map
*		With the addition of the following:
*			debug : (bool) Used to show debugging messages in the console
*		 	imagePath : (string) Used to set the image directory (for map markers)
*
*	Uses Schema.org geocoordinates to get data for the map points http://schema.org/GeoCoordinates
*	Each map point must contain a class (can have multiple) named the same as the map id the point belongs to 
*	Each map has optional data attribute of zoomlevel to define the zoom level of map
*	
*	TODO's: Optional / additional layers.
*			Need to get custom icons working properly, currently the popovers offset is incorrect.
*			Expose methods on the plugin to be called externally $('...').leafletify( 'points' ); (return list of points for map)
*			
*
*/

(function( $, window, document, undefined ) {

	// Simple debug method
	var _debug = function() {
		window.console && console.log && console.log( arguments );
	};

	$.fn.leafletify = function( options ) {

		try {

			// First up, let's make sure we have included Leaflet library
			// Check the existence of 'L' on the window object to prevent more errors.
			if( !window.L ) {
				throw 'Leaflet not found';
			} else {
				var localL = L.noConflict();
			}

			// Our default settings
			var settings = {
				debug : false
			};

			// Override our defaults settings with values passed in
			if( options !== undefined ) {
				$.extend( settings, options );
			}

			// Trigger debugging messages if we want them
			if( settings.debug ) {
				_debug = _debug;
			} else {
				_debug = function() {}; // do nothing if error happens
			}

			// Overwrite the image path so you can serve images from another directory other than js.
			if( settings.imagePath ) {
				localL.Icon.Default.imagePath = settings.imagePath;
			}

			// Create a reusable OpenStreetMap tile layer
			var OSMtileLayer = localL.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
			});

			var mapIcons = {}; // Storing the icons found rather than keep re-using them
			
			// Loop over each map
			this.each(function() {

				var mapPoints = []; // MapPoints for this map

				try {

					// Get the mapName & init an object ready to store all the points on it
					var mapName = $(this).data( 'mapname' );

					// We need to know the map's name before we can find the points associated with it!
					if( !mapName ) {
						throw "Cannot find points, no name for map specified.";
					}

					// Find all the points for this map
					$( '.' + mapName ).each(function() {
						try {

							// Get some data from the DOM of the mapPoint
							var data = $(this).data();

							// Our all important lat / lons
							var latitude = $('[itemprop="latitude"]', $(this) );
							var longitude = $('[itemprop="longitude"]', $(this) );

							// Now make sure we have values we need
							if( latitude.length && longitude.length ) {

								// Add this mapPoint to a list ready to add on a map later
								// Only add point if we have the data
								if( latitude[0].content && longitude[0].content ) {

									// Make a point object, min requirements (lat & lon)
									var pointObj = {
										lat : latitude[0].content,
										lon : longitude[0].content
									};

									// You want a custom icon?
									if( data.mapicondiv ) {
										// Use the icon we have already stored or Go & find that icon & store it for re-use
										// Because we are doing a DOM lookup to get the icon, this is more efficient.
										if( mapIcons[data.mapicondiv] !== undefined ) {
											pointObj.icondiv = mapIcons[data.mapicondiv];
										} else if( $( '.' + data.mapicondiv ).length ) {
											// We only want to get here if the icon actually exists in the dom.
											mapIcons[data.mapicondiv] = localL.divIcon({
												className : data.mapicondiv,
												iconSize : null
											});
											pointObj.icondiv = mapIcons[data.mapicondiv];
										}
									}

									// Great... now did this point want a popover?
									if( data.popover ) {
										// Use the content from inside the 'place' schema
										// TODO: Find a way later to allow user to choose content alternative
										// (perhaps passing in a selector?)
										pointObj.popover = $(this).html();
									}

									// Push map point onto this mapPoints array
									mapPoints.push( pointObj );
								}
							}
						} catch( e ) {
							// Catching errors to allow the loop to continue
							_debug( 'Listing Map Point Error: ' + e );
						}
					});

					//== Init our map & add points to it

					// Create an instance of a leaflet map
					// Works on using the html element of this map ( $(this).get(0))
					var map = localL.map( $(this).get(0), settings );

					// Store this map's state. Used to prevent trying to re-init the points again later.
					var mapInitialized = false;

					// Some event binding on the mapContainer
					$(this).on( 'showMap', function() {

						// Hold a list of ALL the lats & lons to set the map centre later	
						var latLngs = [];

						// If we've already init'd this map... just refresh it on show.
						if( mapInitialized === true ) {
							map.invalidateSize();
						} else {
							// Get details from the map container
							var mapData = $(this).data();

							// Need to clone the layer before we use it otherwise it causes problems
							// with multiple maps.
							var tiles = jQuery.extend( {}, OSMtileLayer );
							tiles.addTo( map ); // Add this layer to our map

							// Loop over the points
							for( var i = 0, len = mapPoints.length; i < len; i++ ) {
								// Catch any problems & move on to next marker here
								try {
									// Hold this points lat & lon
									var latLng = [mapPoints[i].lat,mapPoints[i].lon];

									// Add this point to our latLng list ready to use when centering the map
									latLngs.push( latLng );

									// Hold some options, some maybe optional so build this object up based on conditions later.
									var markerOptions = {};

									// If we had an icon div, use that
									if( mapPoints[i].icondiv ) {
										markerOptions.icon = mapPoints[i].icondiv;
									}

									// Add a marker to the map
									var marker = localL.marker( latLng, markerOptions ).addTo( map );

									// Bind a popover to our marker if we have one
									// TODO: Find a way to make the offset dynamic based on the marker size (right now it
									// positions itself directly over the marker image)
									if( mapPoints[i].popover !== undefined ) {
										marker.bindPopup( mapPoints[i].popover );
									}
								} catch( e ) {
									_debug( 'Marker Error: ' + e );
								}
							}

							// Set the boundries of the map view
							map.fitBounds( latLngs );

							// If we want to be Zoomed in at a specific level, do that.
							if( mapData.zoomlevel ) {
								map.setZoom( mapData.zoomlevel );
							}

							// Now we've done all the hard work... let's not repeat ourselves
							// hold the state here.
							mapInitialized = true;
						}

					}).on( 'hideMap', function() {
						// Nothing needed here yet... useful to know we can do something on hide later
					});

					// Trigger the first event to show the map on load (only if it's visible)
					if( $(this).is( ':visible' ) ) {
						$(this).trigger( 'showMap' );
					}

				} catch( e ) {
					_debug( 'Map loop error: ' + e );
				}

			});

		} catch( e ) {
			_debug( 'Leafletify error: ' + e );
		}
		
		return this;
	}
	
})( jQuery, window, document );