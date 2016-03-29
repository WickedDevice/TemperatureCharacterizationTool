angular.module('MyApp', ['ngFileUpload'])
.controller('UploadCtrl', ['$scope', 'Upload', '$timeout', function ($scope, Upload, $timeout) {

    $scope.csvdata = [];
    $scope.zoom_start_date = null;
    $scope.zoom_end_date = null;
    $scope.trace2_field = 5; // no2 voltage
    $scope.csv_header_row = [];
    $scope.secondary_column = 5;
    $scope.secondary_heading = null;
    $scope.temperature_csv_index = 1;
    $scope.generated_filename = null;

    $scope.time_windows = [{}, {}, {}, {}, {}];
    $scope.secondary_means = [null, null, null, null, null];
    $scope.secondary_stdevs = [null, null, null, null, null];
    $scope.secondary_counts = [null, null, null, null, null];
    $scope.temperature_means = [null, null, null, null, null];
    $scope.temperature_stdevs = [null, null, null, null, null];
    $scope.temperature_counts = [null, null, null, null, null];
    $scope.selected_bin = 0;
    $scope.slopes = [null, null, null, null];
    $scope.intercepts = [null, null, null, null];
    $scope.cli_commands = "";
    $scope.hide_stats_data = true;

    $scope.hideStats = function(){ $scope.hide_stats_data = true; }
    $scope.showStats = function(){ $scope.hide_stats_data = false; }

    $scope.header_loaded = function(){
        return $scope.csv_header_row.length > 0;
    };
    $scope.secondary_column_change = function(){
        $scope.trace2_field = $scope.secondary_column;
        $scope.secondary_heading = $scope.csv_header_row[$scope.secondary_column].name;

        for(var ii = 0; ii < 5; ii++){
            $scope.secondary_means[ii] = null;
            $scope.secondary_stdevs[ii] = null;
            $scope.secondary_counts[ii] = null;
            $scope.temperature_means[ii] = null;
            $scope.temperature_stdevs[ii] = null;
            $scope.temperature_counts[ii] = null;
        }

        for(var ii = 0; ii < 4; ii++){
            $scope.slopes[ii] = null;
            $scope.intercepts[ii] = null;
        }

        $scope.selected_bin = 0;
        $scope.cli_commands = "";

        renderPlots();

        var restore_zoom_start_date = moment($scope.zoom_start_date);
        var restore_zoom_end_date = moment($scope.zoom_end_date);

        for(var ii = 1; ii < 5; ii++){
            $scope.zoom_start_date = moment($scope.time_windows[ii].start_moment);
            $scope.zoom_end_date = moment($scope.time_windows[ii].end_moment);
            $scope.selected_bin = ii;
            plotHistograms();
        }

        $scope.selected_bin = 0;
        $scope.zoom_start_date = moment(restore_zoom_start_date);
        $scope.zoom_end_date = moment(restore_zoom_end_date);
        plotHistograms();

    };

    $scope.window_duration = function(index){
        if($scope.time_windows[index].start_moment && $scope.time_windows[index].end_moment){
              return $scope.time_windows[index].end_moment
                .diff($scope.time_windows[index].start_moment, "Minutes").toFixed(0) + " minutes";
        }
        return null;
    };

    $scope.uploadFiles = function (files) {
        $scope.files = files;
        if (files && files.length) {
            $scope.generated_filename = null;
            Upload.upload({
                url: '/upload',
                method: 'POST',
                data: {
                    files: files
                }
            }).then(function (response) { // file is uploaded successfully
                $timeout(function () {
                    $scope.result = response.data;
                    $scope.progress = -1; // clear the progress bar

                    $scope.csv_header_row = response.data.data[0].map(function(value, index){
                       return {
                           idx: index,
                           name: value
                       };
                    });
                    $scope.generated_filename = response.data.filename.split(".")[0];
                    $scope.csvdata = response.data.data;
                    for(var ii = 1; ii < $scope.csvdata.length; ii++){
                        var m = moment($scope.csvdata[ii][0], "YYYY-MM-DD HH:mm:ss");
                        $scope.csvdata[ii][0] = {
                            str: $scope.csvdata[ii][0],
                            moment: m
                        };

                        for(var jj = 1; jj < $scope.csvdata[ii].length; jj++){
                            var val = null;
                            try{
                                val = parseFloat($scope.csvdata[ii][jj])
                                if(!isNaN(val)) {
                                    $scope.csvdata[ii][jj] = val;
                                }
                                else{
                                    $scope.csvdata[ii][jj] = null;
                                }
                            }
                            catch(e){
                                $scope.csvdata[ii][jj] = null;
                            }
                        }
                    }

                    $scope.secondary_heading = $scope.csv_header_row[$scope.secondary_column].name;
                    renderPlots();
                });
            }, function (response) {      // handle error
                if (response.status > 0) {
                    $scope.errorMsg = response.status + ': ' + response.data;
                    $scope.progress = -1; // clear the progress bar
                }
            }, function (evt) {          // progress notify
                $scope.progress =
                    Math.min(100, parseInt(100.0 * evt.loaded / evt.total));
            });
        }
    };

    function renderPlots(){
        var trace1 = {
            x: $scope.csvdata.map(function(currentValue, index){
                return currentValue[0].str;
            }).slice(1),
            y: $scope.csvdata.map(function(currentValue, index){
                return parseFloat(currentValue[$scope.trace2_field]);
            }).slice(1),
            mode: 'markers',
            yaxis: 'y2',
            type: 'scatter',
            name: $scope.secondary_heading
        };

        var trace2 = {
            x: $scope.csvdata.map(function(currentValue, index){
                return currentValue[0].str;
            }).slice(1),
            y: $scope.csvdata.map(function(currentValue, index){
                return parseFloat(currentValue[$scope.temperature_csv_index]);
            }).slice(1),
            mode: 'lines+markers',
            yaxis: 'y',
            type: 'scatter',
            name: $scope.csv_header_row[$scope.temperature_csv_index].name
        };

        var data = [trace1,trace2];

        var layout = {
            title: $scope.secondary_heading+ " vs Time",
            height: 600,
            yaxis: {title: 'Temperature'},
            yaxis2: {
                title: $scope.secondary_heading,
                overlaying: 'y',
                side: 'right'
            }
        };

        Plotly.newPlot('scatterplot', data, layout);
        $scope.zoom_start_date = $scope.csvdata[1][0].moment;
        $scope.zoom_end_date = $scope.csvdata[$scope.csvdata.length - 1][0].moment;

        $scope.time_windows[$scope.selected_bin].start_moment = $scope.zoom_start_date;
        $scope.time_windows[$scope.selected_bin].end_moment  = $scope.zoom_end_date;

        $('#'+"scatterplot").bind('plotly_relayout',function(event, eventdata){
            if(eventdata["xaxis.autorange"]){
                $scope.zoom_start_date = $scope.csvdata[1][0].moment;
                $scope.zoom_end_date = $scope.csvdata[$scope.csvdata.length - 1][0].moment;

                $scope.time_windows[$scope.selected_bin].start_moment = $scope.zoom_start_date;
                $scope.time_windows[$scope.selected_bin].end_moment  = $scope.zoom_end_date;

            }
            else if(eventdata["xaxis.range[0]"] && eventdata["xaxis.range[1]"]){
                $scope.zoom_start_date = moment(eventdata["xaxis.range[0]"]);
                $scope.zoom_end_date = moment(eventdata["xaxis.range[1]"]);

                $scope.time_windows[$scope.selected_bin].start_moment = $scope.zoom_start_date;
                $scope.time_windows[$scope.selected_bin].end_moment  = $scope.zoom_end_date;
            }

            plotHistograms();
            $scope.$apply();
        });

        plotHistograms();
    }

    function plotHistograms(){
        var secondary_sum = 0;
        var secondary_count = 0;

        var data = $scope.csvdata.slice(1).filter(function(value){
            var m = value[0].moment;
            return m.isAfter($scope.zoom_start_date) && m.isBefore($scope.zoom_end_date);
        }).map(function(currentValue, index){
            if(currentValue[$scope.trace2_field] !== null) {
                secondary_sum += currentValue[$scope.trace2_field];
                secondary_count++;
            }
            return currentValue[$scope.trace2_field];
        });

        if(secondary_count > 0) {
            $scope.secondary_counts[$scope.selected_bin] = secondary_count;
            $scope.secondary_means[$scope.selected_bin] = secondary_sum / secondary_count;

            var sum_square_diffs = 0;
            for(var ii = 0; ii < data.length; ii++){
                if(data[ii] !== null) {
                    var diff = data[ii] - $scope.secondary_means[$scope.selected_bin];
                    sum_square_diffs += diff * diff;
                }
            }
            $scope.secondary_stdevs[$scope.selected_bin] = Math.sqrt(sum_square_diffs / secondary_count);
        }

        var histogram = [
            {
                x: data,
                type: 'histogram'
            }
        ];

        var layout = {
            //xaxis: {
            //    dtick: 0.0000001
            //},
            title: $scope.secondary_heading + " Histogram"
        };

        Plotly.newPlot('histogram', histogram, layout);

        var temperature_sum = 0;
        var temperature_count = 0;

        var temperature_data = $scope.csvdata.slice(1).filter(function(value){
            var m = value[0].moment;
            return m.isAfter($scope.zoom_start_date) && m.isBefore($scope.zoom_end_date);
        }).map(function(currentValue, index){
            if(currentValue[$scope.temperature_csv_index] !== null) {
                temperature_sum += currentValue[$scope.temperature_csv_index];
                temperature_count++;
            }
            return currentValue[$scope.temperature_csv_index];
        });

        if(temperature_count > 0) {
            $scope.temperature_counts[$scope.selected_bin] = temperature_count;
            $scope.temperature_means[$scope.selected_bin] = temperature_sum / temperature_count;

            var sum_square_diffs = 0;
            for(var ii = 0; ii < temperature_data.length; ii++){
                if(temperature_data[ii] !== null) {
                    var diff = temperature_data[ii] - $scope.temperature_means[$scope.selected_bin];
                    sum_square_diffs += diff * diff;
                }
            }
            $scope.temperature_stdevs[$scope.selected_bin] = Math.sqrt(sum_square_diffs / temperature_count);
        }

        var temperature_histogram = [
            {
                x: temperature_data,
                type: 'histogram'
            }
        ];

        var temperature_layout = {
            //xaxis: {
            //    dtick: 0.01
            //},
            title: "Temperature Histogram"
        };

        Plotly.newPlot('temperature_histogram', temperature_histogram, temperature_layout);

        updateSlopesAndIntercepts();
        updateCliCommands();
    }

    function updateSlopesAndIntercepts(){
        for(var ii = 0, jj = 1; ii < 4; ii++, jj++){
            if($scope.secondary_means[ii] && $scope.secondary_means[jj]
              && $scope.temperature_means[ii] && $scope.temperature_means[jj]){
                $scope.slopes[ii] = computeSlope(
                    $scope.temperature_means[ii],
                    $scope.secondary_means[ii],
                    $scope.temperature_means[jj],
                    $scope.secondary_means[jj]);

                $scope.intercepts[ii] = computeIntercept(
                    $scope.temperature_means[ii],
                    $scope.secondary_means[ii],
                    $scope.temperature_means[jj],
                    $scope.secondary_means[jj]);
            }
        }
    }

    // given two points on a line, calculate the slope of the line
    function computeSlope(xa, ya, xb, yb){
        return (yb - ya) / (xb - xa);
    }

    // given two points on a line, calculate the slope of the line
    function computeIntercept(xa, ya, xb, yb){
        var m = computeSlope(xa, ya, xb, yb);
        return ya - (m * xa);
    }

    function updateCliCommands(){
        var prefix = "";
        if($scope.secondary_heading.slice(0, 6) == "no2[V]"){
            prefix = "no2";
        }
        else if($scope.secondary_heading.slice(0, 5) == "co[V]"){
            prefix = "co";
        }
        else if($scope.secondary_heading.slice(0, 5) == "so2[V]"){
            prefix = "so2";
        }
        else if($scope.secondary_heading.slice(0, 5) == "o3[V]"){
            prefix = "o3";
        }
        else if($scope.secondary_heading.slice(0, 5) == "pm[V]"){
            prefix = "pm";
        }

        $scope.cli_commands = "";
        for(var ii = 0; ii < 4; ii++){
            if($scope.slopes[ii] && $scope.intercepts[ii]){
                if(ii == 0){
                    $scope.cli_commands += prefix + "_blv clear";
                }
                $scope.cli_commands += "\n";
                $scope.cli_commands += prefix + "_blv add ";
                $scope.cli_commands += $scope.temperature_means[ii].toFixed(8) + " ";
                $scope.cli_commands += $scope.slopes[ii].toFixed(8) + " ";
                $scope.cli_commands += $scope.intercepts[ii].toFixed(8);
            }
        }
    }
}]);