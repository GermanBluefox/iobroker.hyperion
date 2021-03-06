"use strict";
var utils =    require(__dirname + '/lib/utils'); // Get common adapter utils
var adapter = utils.adapter('hyperion');
var Hyperion = require('hyperion-client');
var convert = require('color-convert');
var hyperion;
adapter.on('unload', function (callback) {
    try {
        adapter.log.info('cleaned everything up...');
        callback();
    } catch (e) {
        callback();
    }
});

// todo
adapter.on('discover', function (callback) {

});

// todo
adapter.on('install', function (callback) {

});

// todo
adapter.on('uninstall', function (callback) {

});

// is called if a subscribed object changes
adapter.on('objectChange', function (id, obj) {
    adapter.log.info('objectChange ' + id + ' ' + JSON.stringify(obj));
});

adapter.on('stateChange', function (id, state) {
    if (!state.ack) {
        var id_arr = id.split('.');
        if (id_arr[id_arr.length - 1] === 'activator') {
            setEffect_on_hyperion(id);
        } else if (id_arr[2] === 'activeColor') {
            console.log(JSON.stringify(state));
            var myval = state.val;
            console.log(myval);
            //setactiveColor_on_hyperion(myval);
        } else if (id_arr[3] === 'activeColorRGB') {
            adapter.log.info(JSON.stringify(state));
            var myval = state.val;
            console.log(myval);
            setactiveColor_on_hyperion(myval);
        } else if (id_arr[3] === 'clear') {
            hyperion.clear(function(err, state){
               adapter.log.info(state);
            });
            //adapter.getState("activeColorRGB", adapter.log.info());
        } else if (id_arr[3] === 'clearall') {

            hyperion.clearall(function(state,err){
                adapter.log.info(state);
            });
        } else if (id_arr[3] === 'activeColorLum') {
            var mylum = state.val;
            adapter.getState("control.activeColorSat", function(err, state){
              var mysat = state.val || 0;
                adapter.getState("control.activeColorHue", function(err, state){
                    var myhue = state.val || 0;
                    setcolorHSL(myhue, mysat, mylum);
                }.bind(mysat).bind(mylum));
            }.bind(mylum));
        } else if (id_arr[3] === 'activeColorSat') {
            var mysat = state.val;
            adapter.getState("control.activeColorLum", function(err, state){
                var mylum = state.val || 0;
                adapter.getState("control.activeColorHue", function(err, state){
                    var myhue = state.val || 0;
                    setcolorHSL(myhue, mysat, mylum);
                }.bind(mysat).bind(mylum));
            }.bind(mysat));

        } else if (id_arr[3] === 'activeColorHue') {
            var myhue = state.val;
            adapter.getState("control.activeColorSat", function(err, state){
                var mysat = state.val || 0;
                adapter.getState("control.activeColorLum", function(err, state){
                    var mylum = state.val || 0;
                    setcolorHSL(myhue, mysat, mylum);
                }.bind(mysat).bind(myhue));
            }.bind(myhue));
        }
    }
});

function setcolorHSL(hue, sat, lum){
    var myrgb = convert.hsl.rgb(hue, sat, lum);
    adapter.log.info("HUE " + hue + " Sat " + sat + " LUM " + lum + " RGB " + myrgb);
    setactiveColor_on_hyperion(myrgb[0]+ "," + myrgb[1] + "," + myrgb[2]);
}

function clean_number(number){

	if (number < 0) {
		number = number * (-1);
	};
	
	if (number > 255){
			number = number / 10000;
	};
      	
	return number;

	
};

function setactiveColor_on_hyperion(color){    
  adapter.log.info(color);
    var myrgb = color.split(',');
    myrgb[0] = clean_number(parseInt(myrgb[0]));
    myrgb[1] = clean_number(parseInt(myrgb[1]));
    myrgb[2] = clean_number(parseInt(myrgb[2]));
    hyperion.setColor(myrgb, function( err, result ){
        if (!err) {
            adapter.log.info('Set Color: ' + myrgb);
        } else {
            adapter.log.warning(JSON.stringify(err));
        }
    })
}

function setEffect_on_hyperion(id){
    id = id.replace('activator','effects_effect_name');
    adapter.getState(id, function(err, state){
        if (!err){
            var myname = state.val;
            var myargument_object = {};
            adapter.getStates('effects.'+ id.split('.')[3] + '*',function(err, result){
                var my_res = Object.keys(result);
                for (var i=0;i <= my_res.length - 1; i++){
                    var my_res_arr = my_res[i].split('.');
                    var my_argument = my_res_arr[my_res_arr.length - 1];
                    if (my_argument !== 'activator' & my_argument !== 'effects_effect_name'){
                        if (typeof result[my_res[i]].val === 'string') {
                            if (result[my_res[i]].val.split(',').length > 0) {
                                //value is array
                                var my_val_array = result[my_res[i]].val.split(',').map(function(item) {
                                    return parseInt(item, 10);
                                });


                                myargument_object[my_argument] = my_val_array;
                            }else{
                                //value is string
                                myargument_object[my_argument] = '"' +result[my_res[i]].val + '"';
                            }
                        }else{
                            //value is number
                            myargument_object[my_argument] = result[my_res[i]].val;
                        }
                    }
                }
                console.log(JSON.stringify(myargument_object));
                hyperion.setEffect(myname, myargument_object, function( err, result ) {
                    console.log(myname);
                    if (!err) {
                        adapter.setState('contorl.activeEffects', myname);
                        adapter.log.info('Set effect: ' + myname);
                        //console.log(JSON.stringify(result));
                    } else {
                        adapter.log.warning(JSON.stringify(err));
                    }
                }.bind(myname) )
            }.bind(myname))
        }
    });
}
adapter.on('ready', function () {
    main();
});


function main() {


    hyperion = new Hyperion( adapter.config['address']  || '127.0.0.1', adapter.config['json_port'] || 19444 );
    var Type = require('type-of-is');
    hyperion.on('connect', function(){
        console.log('connected');

        hyperion.getServerinfo(function( err, result ){
            var my_effects = result.info.effects;
            if (my_effects){  //some effects present so create device effects

                var mydevice = {type: 'device',common: {name: 'effects'}, native:{id: 'effects'}};
                adapter.setObject('effects', mydevice);



                for (var effect in my_effects){
                    var new_effect = {};
                    new_effect['type'] = "channel";
                    var my_effect_name = my_effects[effect].name;
                    var my_effect_friendly_name = my_effect_name.replace(".","_").replace(/\s/g,"_").toLowerCase();
                    var myeffect_obj = {type: 'channel', common:{name: my_effect_friendly_name}, native:{id: 'effects' + my_effect_friendly_name}};
                    adapter.setObject('effects' + '.' + my_effect_friendly_name , myeffect_obj);
                    var my_effect_args = my_effects[effect].args;

                    var my_activator_switch = {type: 'state', common: {role: 'button',   type:'switch', name: 'activator'}, native:{id: 'effects' + my_effect_friendly_name + '.activator'}};
                    adapter.setObject('effects' + '.' + my_effect_friendly_name  + '.activator' , my_activator_switch);

                    /*var my_color_switch = {type: 'state', common: {role: 'evel.color.rgb',  name: 'activeColor'}, native:{id: 'effects' + my_effect_friendly_name + '.activeColor'}};
                    adapter.setObject('effects' + '.' + my_effect_friendly_name  + '.activeColor' , my_color_switch);
                    */

                    var my_effect_name_obj = {type: 'state', common: {role: 'text.url', type: 'text', name: 'effect_name'}, native:{id: 'effects_effect_name'}};
                    adapter.setObject('effects' + '.' + my_effect_friendly_name + '.'+ 'effects_effect_name',my_effect_name_obj);
                    adapter.setState('effects' + '.' + my_effect_friendly_name + '.'+ 'effects_effect_name',my_effects[effect].name);
                    for (var myarg in my_effect_args){
                        var my_arg_name = myarg;
                        var my_arg = my_effect_args[myarg];
                        var my_argument_obj = {};
                        if (Type.is(my_arg, Number)){
                            my_argument_obj = {type: 'state', common: {role: 'level', type: 'number', name: my_arg_name}, native:{id: 'effects' + my_effect_friendly_name + my_arg_name}};
                            adapter.setObject('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name, my_argument_obj);
                            adapter.setState('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name, my_arg);
                        }else if(Type.is(my_arg, Boolean)){
                            my_argument_obj = {type: 'state', common: {role: 'switch', type: 'state', name: my_arg_name}, native:{id: 'effects' + my_effect_friendly_name + my_arg_name}};
                            adapter.setObject('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name, my_argument_obj);
                            adapter.setState('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name, my_arg);
                        }else if(Type.is(my_arg, String)){
                            my_argument_obj = {type: 'state', common: {role: 'text.url', type: 'text', name: my_arg_name}, native:{id: 'effects' + my_effect_friendly_name + my_arg_name}};
                            adapter.setObject('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name, my_argument_obj);
                            adapter.setState('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name, my_arg);
                        }else if(Type.is(my_arg, Array)){
                            my_argument_obj  = {type: 'state', common: {role: 'level.color.rgb',  name: my_arg_name}, native:{id: 'effects' + my_effect_friendly_name + my_arg_name}};
                            adapter.setObject('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name , my_argument_obj);
                            adapter.setState('effects' + '.' + my_effect_friendly_name  + '.' + my_arg_name, my_arg[0] +',' + my_arg[1] + ',' +my_arg[2]);
                        }else{
                            adapter.log.info("The Argument " + my_arg_name + " is " + my_arg + " and of type " + typeof my_arg);
                        }
                    }
                }
            }


            var my_adjustment = result.info.adjustment;

            if(my_adjustment){
                var mydevice = {type: 'device',common: {name: 'adjustment'}, native:{id: 'adjustment'}};
                adapter.setObject('adjustment', mydevice);
                for (var adjustment in my_adjustment){
                    var my_adj_elm = my_adjustment[adjustment];
                    var my_adj_id = my_adj_elm.id || 'default';
                    var my_adj_obj = {type: 'channel', common:{name: my_adj_id}, native:{id: 'adjustment' + my_adj_id}};
                    adapter.setObject('adjustment' + '.' + my_adj_id , my_adj_obj);
                    var my_red_Adjust = {type: 'state', common: {role: 'level.color.rgb', name: 'my_red_Adjust'}, native:{id: 'adjustment' + my_adj_id  + 'my_red_Adjust'}};
                    var my_green_Adjust = {type: 'state', common: {role: 'level.color.rgb', name: 'my_green_Adjust'}, native:{id: 'adjustment' + my_adj_id  + 'my_green_Adjust'}};
                    var my_blue_Adjust = {type: 'state', common: {role: 'level.color.rgb', name: 'my_blue_Adjust'}, native:{id: 'adjustment' + my_adj_id  + 'my_blue_Adjust'}};
                    adapter.setObject('adjustment.' + my_adj_id  + '.my_red_Adjust', my_red_Adjust);
                    adapter.setObject('adjustment.' + my_adj_id  + '.my_green_Adjust', my_green_Adjust);
                    adapter.setObject('adjustment.' + my_adj_id  + '.my_blue_Adjust', my_blue_Adjust);
                    adapter.setState('adjustment.' + my_adj_id  + '.my_red_Adjust', my_adj_elm.redAdjust[0] + ',' + my_adj_elm.redAdjust[1]  + ','  + my_adj_elm.redAdjust[2] );
                    adapter.setState('adjustment.' + my_adj_id  + '.my_green_Adjust', my_adj_elm.greenAdjust[0] + ',' + my_adj_elm.greenAdjust[1]  + ','  + my_adj_elm.greenAdjust[2] );
                    adapter.setState('adjustment.' + my_adj_id  + '.my_blue_Adjust', my_adj_elm.blueAdjust[0] + ',' + my_adj_elm.blueAdjust[1]  + ','  + my_adj_elm.blueAdjust[2] );
                }

            }
        })
    });



    adapter.subscribeStates('*');
}
