var expressPromiseRouter = require("express-promise-router");
var router = expressPromiseRouter();
var Promise = require("bluebird");
multiparty = require('connect-multiparty');
multipartyMiddleware = multiparty();
var fs = require('fs-extra-promise');
var moment = require('moment');
var csvparse= Promise.promisify(require('csv-parse'));
var csvstringify = Promise.promisify(require('csv-stringify'));

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.post('/upload', multipartyMiddleware, function(req, res, next) {
  // We are able to access req.files.file thanks to
  // the multiparty middleware
  var files = req.files.files;
  var dest = __dirname.split("/").slice(0, -1).join("/") + "/uploads/" + files[0].originalFilename;

  return Promise.try(function() {
    return files;
  }).map(function(file){
    // read the file contents into memory
    return fs.readFileAsync(file.path);
  }).map(function(fileContents){
    // parse the file contents as CSV
    return Promise.try(function(){
        return csvparse(fileContents);
    }).catch(function(err){
        console.log(err);
        return null;
    });
  }).filter(function(parsedCsv){
      // reject malformed CSV, but move on with the analysis
      return parsedCsv != null;
  }).map(function(parsedCsv){
    // determine the first and last date in this file
    var first_date = null;
    var last_date = null;
    for(var ii = 0; ii < parsedCsv.length; ii++){
        var row = parsedCsv[ii];
        if(row && row.length > 0){

          var m = null;
          try{
            m = moment(row[0], "MM/DD/YYYY HH:mm:ss");
          }
          catch(e){}; //TODO: discouraged but it's going to happen on the header row

          if(m.isValid()){
            row[0] = m; // keep it around as a moment
            if(!first_date){
              first_date = m;
            }
            else if(m.isBefore(first_date)){
              first_date = m;
            }

            if(!last_date){
              last_date = m;
            }
            else if(m.isAfter(last_date)){
              last_date = m;
            }
          }
        }
    }
    return {
      rows: parsedCsv,
      first_date: first_date,
      last_date: last_date
    };
  }).then(function(analyzedParsedCsvData){
    // what is the first and last date across all files
    var first_date = analyzedParsedCsvData[0].first_date;
    var last_date = analyzedParsedCsvData[0].last_date;
    for(var ii = 0; ii < analyzedParsedCsvData.length; ii++){
      if(analyzedParsedCsvData[ii].first_date.isBefore(first_date)){
        first_date = analyzedParsedCsvData[ii].first_date;
      }

      if(analyzedParsedCsvData[ii].last_date.isAfter(last_date)){
        last_date = analyzedParsedCsvData[ii].last_date;
      }
    }

    console.log(first_date.format() + " -- " + last_date.format());

    // now go through and merge the files  seek out
    var search_indexes = analyzedParsedCsvData.map(function(){ return 1 ; }); // an array of ones
    var merged_data = []; // this will be an array of rows when we're done
    merged_data.push(analyzedParsedCsvData[0].rows[0]); // the first row of the first record should be a header row

    var sample_rate = 5;
    var half_sample_rate = sample_rate / 2;

    // iterate over the time span at the sample rate
    var found = false;
    var start = moment();
    console.log("Beginning merge @ " + start.format());
    while(first_date.isBefore(last_date)){
      var end_of_window = moment(first_date).add(half_sample_rate);
      var start_of_window = moment(first_date).subtract(half_sample_rate);

      // for each sample moment, search for a record in each file that
      // is within a half_sample _rate of the current moment of interest
      // advance the pointer in each file until it is beyond the window
      found = false;
      for(var ii = 0; ii < analyzedParsedCsvData.length; ii++){
        var jj;
        for(jj = search_indexes[ii]; jj < analyzedParsedCsvData[ii].rows.length; jj++){
          var row = analyzedParsedCsvData[ii].rows[jj];
          var row_timestamp = row[0];
          if(!found) {
            if (row_timestamp.isBefore(end_of_window)
              && row_timestamp.isAfter(start_of_window)) {
              // we have a winner for this moment, store it and set the flag
              merged_data.push(row); // this is a row
              found = true;
            }
          }

          if(row_timestamp.isAfter(end_of_window)){
            break;
          }
        }

        search_indexes[ii] = jj;
      }

      first_date.add(sample_rate, 'seconds')
    }
    console.log("Merge complete @ " + moment().format() + " [" + moment().diff(start, "seconds") + "], merged down to " + merged_data.length + " records");

    return merged_data;

  }).then(function(merged_data){
    var m;
    for(var ii = 0; ii < merged_data.length; ii++){
      var m = merged_data[ii][0];
      if(m && m.isValid && m.isValid()){
        merged_data[ii][0] = m.format("MM/DD/YYYY HH:mm:ss");
      }
    }

    return Promise.try(function(){
      return csvstringify(merged_data);
    }).then(function(merged_data_as_string){
      return fs.writeFileAsync(dest, merged_data_as_string);
    }).catch(function(err){
      console.log(err);
    })
  }).catch(function(exception){
    console.log(exception);
  });
});

module.exports = router;

/*
 var src = file.path;
 var dest = __dirname.split("/").slice(0, -1).join("/") + "/uploads/" + file.originalFilename;
 var f = {
 originalFilename: file.originalFilename
 };
 return Promise.try(function(){
 return fs.copyAsync(src, dest);
 }).then(function(){
 return f;
 }).catch(function(){
 console.log("Copy failed");
 });
 */