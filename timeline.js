function timeline(domElement) {

  //--------------------------------------------------------------------------
  //
  // chart
  //

  // chart geometry
  var margin = {top: 100, right: 20, bottom: 20, left: 20},
      outerWidth = 3000,
      outerHeight = 500,
      width = outerWidth - margin.left - margin.right,
      height = outerHeight - margin.top - margin.bottom;

  // global timeline variables
  var timeline = {},   // The timeline
      data = {},       // Container for the data
      components = [], // All the components of the timeline for redrawing
      bandGap = 25,    // Arbitray gap between consecutive bands
      bands = {},      // Registry for all the bands in the timeline
      bandY = 0,       // Y-Position of the next band
      bandNum = 0;     // Count of bands for ids

  // Create svg element
  var svg = d3.select(domElement).append("svg")
              .attr("class", "svg")
              .attr("id", "svg")
              .attr("width", outerWidth)
              .attr("height", outerHeight)
              .append("g")
              .attr("transform", "translate(" + margin.left + "," + margin.top +  ")");

  svg.append("clipPath")
     .attr("id", "chart-area")
     .append("rect")
     .attr("width", width)
     .attr("height", height);

  var chart = svg.append("g")
                 .attr("class", "chart")
                 .attr("clip-path", "url(#chart-area)");

  var tooltip = d3.select("body")
                  .append("div")
                  .attr("class", "tooltip")
                  .style("visibility", "hidden");

  //--------------------------------------------------------------------------
  //
  // data
  //

  timeline.data = function(items) {
    var tracks = [],
        yearMillis = 31622400000,
        instantOffset = 200 * yearMillis;
    data.items = items;

    function compareItems(item1, item2) {
      var result = item1.start - item2.start;
      if (result < 0) { return -1; }
      if (result >= 0) { return 1; }
    }

    function calculateTracks(items) {
      var i, track;

      function sortItems() {
        items.forEach(function (item) {
          for (i = 0, track = 0; i < tracks.length; i++, track++) {
            if (item.start > tracks[i]) { break; }
          }

          item.track = track;
          tracks[track] = item.start.getTime() + instantOffset;
        });
      }

      data.items.sort(compareItems);
      sortItems();
    }

    data.items.forEach(function (item){
      item.start = parseDate(item.start);
        item.instant = true;
    });

    calculateTracks(data.items);
    data.nTracks = tracks.length;
    data.minDate = d3.min(data.items, function (d) { return d.start; });
    data.maxDate = new Date(d3.max(data.items, function (d) { return d.start.getTime(); }) + instantOffset);

    return timeline;
  };

  //----------------------------------------------------------------------
  //
  // band
  //

  timeline.band = function (bandName, sizeFactor) {
    var band = {};
    band.id = "band" + bandNum;
    band.x = 0;
    band.y = bandY;
    band.w = width;
    band.h = height * (sizeFactor || 1);
    band.trackOffset = 2;
    band.trackHeight = Math.min((band.h - band.trackOffset) / data.nTracks, 25);
    band.itemHeight = band.trackHeight,
    band.parts = [],
    band.instantWidth = 100;

    band.xScale = d3.time.scale()
                         .domain([data.minDate, data.maxDate])
                         .range([0, band.w]);

    band.yScale = function (track) {
      return track * 30;
    };

    band.g = chart.append("g")
                  .attr("id", band.id)
                  .attr("transform", "translate(0," + band.y +  ")");

    band.g.append("rect")
          .attr("class", "band")
          .attr("width", band.w)
          .attr("height", band.h);

    var items = band.g.selectAll("g")
                      .data(data.items)
                      .enter().append("svg")
                      .attr("y", function (d) { return band.yScale(d.track); })
                      .attr("height", band.itemHeight)
                      .attr("class", function (d) { return "part instant";});

    var instants = d3.select("#band" + bandNum).selectAll(".instant");
    // instants.append("circle")
    //         .attr("cx", band.itemHeight / 2)
    //         .attr("cy", band.itemHeight / 2)
    //         .attr("r", 5)
    //         .style("fill", function (d) {return colorCircle(d.location);});
    instants.append("text")
            .attr("class", "instantLabel")
            .attr("x", 23)
            .attr("y", 17)
            .text(function (d) { return addLabelSymbol(d) });

    band.addActions = function(actions) {
      actions.forEach(function (action) {
        items.on(action[0], action[1]);
      })
    };

    band.redraw = function () {
      items.attr("x", function (d) { return band.xScale(d.start);})
           .attr("width", function (d) { return 200; });
      band.parts.forEach(function(part) { part.redraw(); })
    };

    bands[bandName] = band;
    components.push(band);
    bandY += band.h + bandGap;
    bandNum += 1;

    return timeline;
  };

  //----------------------------------------------------------------------
  //
  // labels
  //

  timeline.labels = function (bandName) {
    var band = bands[bandName],
        labelWidth = 46,
        labelHeight = 20,
        labelTop = band.y + band.h - 10,
        y = band.y + band.h + 1,
        yText = 15;

    var labelDefs = [];

    var bandLabels = chart.append("g")
                          .attr("id", bandName + "Labels")
                          .attr("transform", "translate(0," + (band.y + band.h + 1) +  ")")
                          .selectAll("#" + bandName + "Labels")
                          .data(labelDefs)
                          .enter().append("g")
                          .on("mouseover", function(d) {
                            tooltip.html(d[5])
                                   .style("top", d[7] + "px")
                                   .style("left", d[6] + "px")
                                   .style("visibility", "visible");
                            })
                          .on("mouseout", function(){
                            tooltip.style("visibility", "hidden");
                          });

    bandLabels.append("rect")
              .attr("class", "bandLabel")
              .attr("x", function(d) { return d[2];})
              .attr("width", labelWidth)
              .attr("height", labelHeight)
              .style("opacity", 1);

    var labels = bandLabels.append("text")
                           .attr("class", function(d) { return d[1];})
                           .attr("id", function(d) { return d[0];})
                           .attr("x", function(d) { return d[3];})
                           .attr("y", yText)
                           .attr("text-anchor", function(d) { return d[0];});

    labels.redraw = function () {
      var min = band.xScale.domain()[0],
          max = band.xScale.domain()[1];

      labels.text(function (d) { return d[4](min, max); })
    };

    band.parts.push(labels);
    components.push(labels);

    return timeline;
  };

  //----------------------------------------------------------------------
  //
  // tooltips
  //

  timeline.tooltips = function (bandName) {
    var band = bands[bandName];

    band.addActions([
      ["mouseover", showTooltip],
      ["mouseout", hideTooltip]
    ]);

    function getHtml(element, d) {
      var title = d.label + "<br>";
      var date = "<i>" + toYear(d.start) + "</i>" + "<br>" + "<br>";
      var description = d.description;

      var html = title + date + description;
      return html;
    }

    function showTooltip (d) {
      var x = event.pageX < band.x + band.w / 2
              ? event.pageX + 10
              : event.pageX - 110,
          y = event.pageY < band.y + band.h / 2
              ? event.pageY + 30
              : event.pageY - 30;

      tooltip.html(getHtml(d3.select(this), d))
             .style("top", y + "px")
             .style("left", x + "px")
             .style("visibility", "visible");
    }

    function hideTooltip () {
      tooltip.style("visibility", "hidden");
    }

    return timeline;
  };

  //----------------------------------------------------------------------
  //
  // xAxis
  //

  timeline.xAxis = function (bandName, orientation) {
    var band = bands[bandName];

    var axis = d3.svg.axis()
                     .scale(band.xScale)
                     .orient(orientation || "bottom")
                     .tickSize(6, 0)
                     .tickFormat(function (d) { return toYear(d); });

    var xAxis = chart.append("g")
                     .attr("class", "axis")
                     .attr("transform", "translate(0," + (band.y + band.h)  + ")");

    xAxis.redraw = function () {
      xAxis.call(axis);
    };

    band.parts.push(xAxis);
    components.push(xAxis);

    return timeline;
  };

  //----------------------------------------------------------------------
  //
  // redraw
  //

  timeline.redraw = function () {
    components.forEach(function (component) {
      component.redraw();
    })
  };

  //--------------------------------------------------------------------------
  //
  // Utility functions
  //

  function addLabelSymbol(item) {
    var symbol;

    switch(item.location) {
      case 'mesopotamia':
        symbol = '✶'
        break;
      case 'greece':
        symbol = 'Ω'
        break;
      case 'india':
        symbol = '✺'
        break;
      case 'china':
        symbol = '❂'
        break;
      case 'rome':
        symbol = '∴'
        break;
      case 'middle-east':
        symbol = '☾';
        break;
      case 'japan':
        symbol = '日';
        break;
      case 'france':
        symbol = '❧';
        break;
      case 'uk':
        symbol = '†';
        break;
      default:
        symbol = '';
    }

    return symbol + " " + item.label;
  }

  function parseDate(dateString) {
    var format = d3.time.format("%Y-%m-%d"),
        date,
        year;

    date = format.parse(dateString);
    if (date !== null) return date;

    if (isNaN(dateString)) { // Handle BC year
      year = -(dateString.replace(/[^0-9]/g, ""));
    } else { // Handle AD year
      year = +dateString;
    }

    if (year < 0 || year > 99) { // 'Normal' dates
      date = new Date(year, 6, 1);
    } else if (year == 0) { // Year 0 is '1 BC'
      date = new Date (-1, 6, 1);
    } else { // Create arbitrary year and then set the correct year
      date = new Date(year, 6, 1);
      date.setUTCFullYear(("0000" + year).slice(-4));
    }

    return date;
  }

  function toYear(date, bcString) {
    bcString = bcString || " BC"
    var year = date.getUTCFullYear();
    if (year > 0) return year.toString();
    if (bcString[0] == '-') return bcString + (-year);
    return (-year) + bcString;
  }

  return timeline;
}