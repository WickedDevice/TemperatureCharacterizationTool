angular.module('MyApp', ['ngFileUpload'])
.controller('UploadCtrl', ['$scope', 'Upload', '$timeout', function ($scope, Upload, $timeout) {

    $scope.csvdata = [];
    $scope.zoom_start_date = null;
    $scope.zoom_end_date = null;
    $scope.trace1_field = 1;
    $scope.trace2_field = 5; // no2 voltage
    $scope.csv_header_row = [];
    $scope.secondary_column = 5;
    $scope.header_loaded = function(){
        return $scope.csv_header_row.length > 0;
    };
    $scope.secondary_column_change = function(){
        $scope.trace2_field = $scope.secondary_column;
        renderPlots();
    };

    $scope.uploadFiles = function (files) {
        $scope.files = files;
        if (files && files.length) {
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
                    $scope.csvdata = response.data.data;

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
                return currentValue[0];
            }).slice(1),
            y: $scope.csvdata.map(function(currentValue, index){
                return parseFloat(currentValue[$scope.trace2_field]);
            }).slice(1),
            mode: 'markers',
            yaxis: 'y2',
            type: 'scatter'
        };

        var trace2 = {
            x: $scope.csvdata.map(function(currentValue, index){
                return currentValue[0];
            }).slice(1),
            y: $scope.csvdata.map(function(currentValue, index){
                return parseFloat(currentValue[$scope.trace1_field]);
            }).slice(1),
            mode: 'lines+markers',
            yaxis: 'y',
            type: 'scatter'
        };

        var data = [trace1,trace2];

        var layout = {
            title: $scope.csv_header_row[$scope.secondary_column].name + " vs Time",
            height: 600,
            yaxis: {title: 'Temperature'},
            yaxis2: {
                title: $scope.csv_header_row[$scope.secondary_column].name,
                overlaying: 'y',
                side: 'right'
            }
        };

        Plotly.newPlot('scatterplot', data, layout);
        $scope.zoom_start_date = moment($scope.csvdata[1][0], "YYYY-MM-DD HH:mm:ss");
        $scope.zoom_end_date = moment($scope.csvdata[$scope.csvdata.length - 1][0], "YYYY-MM-DD HH:mm:ss");

        $('#'+"scatterplot").bind('plotly_relayout',function(event, eventdata){
            if(eventdata["xaxis.autorange"]){
                $scope.zoom_start_date = moment($scope.csvdata[1][0], "YYYY-MM-DD HH:mm:ss");
                $scope.zoom_end_date = moment($scope.csvdata[$scope.csvdata.length - 1][0], "YYYY-MM-DD HH:mm:ss");
            }
            else if(eventdata["xaxis.range[0]"] && eventdata["xaxis.range[1]"]){
                $scope.zoom_start_date = moment(eventdata["xaxis.range[0]"]);
                $scope.zoom_end_date = moment(eventdata["xaxis.range[1]"]);
            }

            plotHistogram();
        });

        plotHistogram();
    }

    function plotHistogram(){
        var data = $scope.csvdata.slice(1).filter(function(value){
            var m = moment(value, "YYYY-MM-DD HH:mm:ss");
            return m.isAfter($scope.zoom_start_date) && m.isBefore($scope.zoom_end_date);
        }).map(function(currentValue, index){
            return currentValue[$scope.trace2_field];
        });

        var histogram = [
            {
                x: data,
                type: 'histogram'
            }
        ];

        var layout = {
            xaxis: {
                dtick: 0.0000001
            }
        }

        Plotly.newPlot('histogram', histogram, layout);
    }
}]);