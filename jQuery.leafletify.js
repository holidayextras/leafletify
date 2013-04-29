/**
*	Leafletify - jQuery plugin to plot points on a map using Leaflet.js (http://leafletjs.com)
*
*	Copyright (c) 2013 Rob Huzzey
*
*	Version 1.0
*
*	Usage: $('.mapPoints').leafletify();
*
*	<div itemscope itemtype="http://schema.org/Place" class="mapItem" data-mapid="map1" data-mapicondiv="icon1">
*		<div itemprop="geo" itemscope itemtype="http://schema.org/GeoCoordinates">
*			<meta itemprop="latitude" content="123456" />
*			<meta itemprop="longitude" content="765432" />
*		</div>
*	</div>	
*
*	Uses Schema.org geocoordinates to get data for the map points http://schema.org/GeoCoordinates
*	Each map point must contain a data attribute defining a map id the point belongs to
*	Each map has optional data attribute of zoomlevel to define the zoom level of map
*	
*	TODO's: Optional / additional layers.
*			Currently optimised for dev version (0.6-dev) due to issues with using divIcons & offsetting popovers.
*			
*
*/

(function( $ ) {

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

			// Create a reusable OpenStreetMap tile layer
			var OSMtileLayer = L.tileLayer('http://{s}.tile.osm.org/{z}/{x}/{y}.png', {
				attribution: '&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
			});

			//== Parse the DOM to get the map Points

			// First up, find all the positions 
			// & store in an object to use later
			var mapPoints = {}; // MapPoints are stored points per mapId
			var mapIcons = {}; // Storing the icons found rather than keep re-using them
			
			// Loop over all the map points
			this.each(function() {

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
						if( data.mapid && latitude[0].content && longitude[0].content ) {

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
									mapIcons[data.mapicondiv] = L.divIcon({
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
						}

						// Make sure we have an array to push data onto
						if( mapPoints[data.mapid] === undefined ) { mapPoints[data.mapid] = []; }
						// Push map point onto this mapPoints object
						mapPoints[data.mapid].push( pointObj );
					}

				} catch( e ) {
					// Catching errors to allow the loop to continue
					_debug( 'Listing Map Point Error: ' + e );
				}

			});

			//== Init our maps & add points to them

			// Loop over each map we expect & add points to them
			for( var mapId in mapPoints ) {

				try {

					// Grab the container we want our map to reside in
					var $mapContainer = $( '#' + mapId );

					// Make sure we have a container to put the map into
					if( $mapContainer.length ) {

						// Create an instance of a leaflet map
						var map = L.map( mapId );

						// Store this map's state. Used to prevent trying to re-init the points again later.
						var mapInitialized = false;

						// Some event binding on the mapContainer
						$mapContainer.on( 'showMap', function() {

							// Hold a list of ALL the lats & lons to sort through & find the map centre later	
							var lats = [];
							var lons = [];

							// If we've already init'd this map... just refresh it on show.
							if( mapInitialized === true ) {
								map.invalidateSize();
							} else {

								// Get details from the map container
								var mapData = $mapContainer.data();

								// Need to clone the layer before we use it otherwise it causes problems
								// with multiple maps.
								var tiles = jQuery.extend( {}, OSMtileLayer );
								tiles.addTo( map ); // Add this layer to our map

								// Loop over the points
								for( var i in mapPoints[mapId] ) {
									// Catch any problems & move on to next marker here
									try {

										// Add to our list of all the lat / lons ready to work out the map centre later.
										lats.push( mapPoints[mapId][i].lat );
										lons.push( mapPoints[mapId][i].lon );

										// Hold some options, some maybe optional so build this object up based on conditions later.
										var markerOptions = {};

										// If we had an icon div, use that
										if( mapPoints[mapId][i].icondiv ) {
											markerOptions.icon = mapPoints[mapId][i].icondiv;
										}

										// Add a marker to the map
										var marker = L.marker( [ mapPoints[mapId][i].lat, mapPoints[mapId][i].lon ], markerOptions ).addTo( map );

										// Bind a popover to our marker if we have one
										// TODO: Find a way to make the offset dynamic based on the marker size (right now it
										// positions itself directly over the marker image)
										if( mapPoints[mapId][i].popover !== undefined ) {
											marker.bindPopup( mapPoints[mapId][i].popover, { offset : [ 0, 0 ] } );
										}

									} catch( e ) {
										_debug( 'Marker Error: ' + e );
									}
								}

								// Work out the centre lat & lon (approximate)
								var cntrLat = lats[ Math.ceil( lats.length / 2 ) ];
								var cntrLon = lons[ Math.ceil( lons.length / 2 ) ];

								// Set the view to centre on this latLng
								map.setView( [ cntrLat, cntrLon ], mapData.zoomlevel || 13 );

								// Now we've done all the hard work... let's not repeat ourselves
								// hold the state here.
								mapInitialized = true;
							}

						}).on( 'hideMap', function() {
							// Nothing needed here yet... useful to know we can do something on hide later
						});

						// Trigger the first event to show the map on load (only if it's visible)
						if( $mapContainer.is( ':visible' ) ) {
							$mapContainer.trigger( 'showMap' );
						}

					}

				} catch( e ) {
					_debug( 'Map Point Error: ' + e );
				}

			}

		} catch( e ) {
			_debug( 'Leafletify error: ' + e );
		}

		return this;

	}

})( jQuery );