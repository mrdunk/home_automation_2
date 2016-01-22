#!/usr/bin/lua

--[[

  Topic format:
    unique_ID/broker_level/role/address_1[/address_2[/address_3[...] ] ]
  where:
    unique_ID is an identifier unique to this instillation.
    broker_level == 0 for a client, broker_level == 1 for a broker. Further values may be used for further levels of broker recursion in the future.
    role is an identifier for the type of operation this topic describes. eg. "lighting" or "heating".
    address_X describe the actual equipment being addressed by the Topic. eg. "dunks_house/kitchen/worktop/left" or "dunks_house/workshop/desk_lamp".

]]--

-- Load libraries
package.path = package.path .. ';/usr/share/homeautomation/?.lua'
require 'os'
require 'file_utils'
-- # opkg install luci-lib-json
json = require "luci.json"

-- Globals
info = {}
info.config = {}
info.config.component = {}
mqtt_instance = {}            -- Will get assigned mqtt instance during initilize() function.
dhcp_instance = {}          -- Will get assigned parse_dhcp instance during initilize() function.
outlets_instance = {}       -- Will get assigned outlets instance during initilize() function.
control_instance = {}
DEBUG = false

-- Constants
WEB_DIR = '/www/info/'
TEMP_DIR = '/tmp/homeautomation/'
local MOSQUITTO_CONF = '/etc/mosquitto/mosquitto.conf'
POWER_SCRIPT_DIR = '/usr/share/homeautomation/power_commands/'



function log(...)
  if DEBUG and arg then
    local result = ''
    for i,v in ipairs(arg) do
      result = result .. tostring(v) .. "\t"
    end
    print(result)
  end
end

function mqtt_instance_ON_PUBLISH()
  --log(" ** mqtt_instance_ON_PUBLISH")
end

function mqtt_instance_ON_MESSAGE(mid, topic, payload)
  --log("mqtt_instance_ON_MESSAGE", mid, topic, payload)

  if topic == nil or payload == nil then
    return
  end

  -- Only match alphanumeric characters and a very limited range of special characters here to prevent easy injection type attacks.
  local unique_ID, incoming_broker_level, incoming_role, incoming_address = string.match(topic, "^([%w_%-]+)/([%w_%-]+)/([%w_%-]+)/([%w_%-/]+)")
  local incoming_data = parse_payload(payload)
  if incoming_data == nil then
    return
  end

  -- Now we have parsed topic and payload, lets remove the temptation to use them again.
  topic = nil
  payload = nil

  -- See which of our subscriptions the incoming topic matches.
  local incoming_path = incoming_role .. '/' .. incoming_address
  for path, class_instances in pairs(info.mqtt.subscriptions) do
    path = var_to_path(path)
    if match_paths(incoming_path, path) then
      for instance, _ in pairs(class_instances) do
        instance:callback(path, incoming_data)
      end
    end
  end
end

function mqtt_instance_ON_CONNECT()
  log(" ** mqtt_instance_ON_CONNECT")

  -- Presume all existing subscriptions are dead.
  for key in pairs(info.mqtt.subscriptions) do
    info.mqtt.subscriptions[key] = nil
  end

  while #info.mqtt.subscriptions > 0 do
    table.remove(info.mqtt.subscriptions, #info.mqtt.subscriptions)
  end
  while #info.mqtt.last_announced > 0 do
    table.remove(info.mqtt.last_announced, #info.mqtt.last_announced)
  end

  for _, loader in pairs(info.mqtt.callbacks) do
    local subscribtions = {}
    if loader.subscribe then
      subscribtions = loader:subscribe()
    end
    for _, subscrition in pairs(subscribtions) do
      subscribe_to_all(loader, subscrition.role, subscrition.address)
    end
  end

  for _, loader in pairs(info.mqtt.callbacks) do
    if loader.announce then
      loader:announce()
    end
  end
end

function parse_payload(data)
  local return_table = {}
  local atoms = split(data, ',')
  local valid_data
  
  for _, atom in pairs(atoms) do
    local key, value = atom:match("^%s*([%w_]+)%s*:%s*([%w_./]+)")
    if key == nil then
      -- Values with whitespace in them must be surrounded by quotes. (")
      key, value = atom:match("^%s*([%w_]+)%s*:%s*\"([%s%w_./]+)\"")
    end
    if key ~= nil then
      valid_data = true
      return_table[key] = value
    end
  end

  if valid_data == true then
    return return_table
  end

  return json.decode(data)
end

function subscribe_to_all(class_instance, role, address)
  address = var_to_path(address)

  local address_partial = ''

  for address_section in address:gmatch("[^/]+") do
    --log("###", role, address_partial .. '/all')
    subscribe_to(class_instance, '_all' .. address_partial .. '/_all')
    subscribe_to(class_instance, role .. address_partial .. '/_all')
    address_partial = address_partial .. '/' .. address_section
  end
  --log("###", role, address_partial)
  subscribe_to(class_instance, '_all' .. address_partial)
  subscribe_to(class_instance, role .. address_partial)
end

function subscribe_to(class_instance, subscription)
  if mqtt_instance:subscribe('homeautomation/+/' .. var_to_path(subscription)) == nil then
    -- Probably not connected to broker yet.
    log('...subscription failed.')
    return
  end
  if info.mqtt.subscriptions[path_to_var(subscription)] == nil then
    log('First subscribing to: homeautomation/+/' .. var_to_path(subscription))
    info.mqtt.subscriptions[path_to_var(subscription)] = {}
  end
  if info.mqtt.subscriptions[path_to_var(subscription)][class_instance] == nil then
    log('Subscribing to: homeautomation/+/' .. var_to_path(subscription))
    info.mqtt.subscriptions[path_to_var(subscription)][class_instance] = true
  end
end

function match_paths(path_one, path_two, all)
  local role_one, address_one = path_one:match('(.-)/(.+)')
  local role_two, address_two = path_two:match('(.-)/(.+)')

  if role_two ~= '+' and role_one ~= role_two then
    return
  end

  local atoms_one = split(address_one, '/')
  local atoms_two = split(address_two, '/')
  
  for i=1,#atoms_one,1 do
    if all and atoms_one[i] == '_all' then
      break
    end
    if atoms_two[i] == '#' then
      break
    end
    if atoms_two[i] ~= '+' and atoms_one[i] ~= atoms_two[i] then
      return
    end
  end
  --log("Match:", path_one, path_two)
  return true
end

-- To be called first.
-- Initialize everything needed to run this program.
function initilize()
  -- The global "info" is the main data structure and contains all data
  -- which is to be passed from one iteration of this code to the next.
  -- The full contents of "info" are displayed on a webpage for debugging:
  -- http://$HOSTNAME/info/server.txt
  if info.io == nil then
    info.io = {}
  end
  info.brokers = {}
  info.host = {interfaces = {},
               processes = {}}
  info.host.processes = {['mosquitto'] = {},
                         ['avahi-daemon'] = {},
                         ['dropbear'] = {},
                         ['uhttpd'] = {}}
  info.config.update_delay = 10
  info.config.last_updated = os.time()
  info.host.hostname = hostname()

  info.mqtt = {}
  info.mqtt.callbacks = {}

  if not info.mqtt.subscriptions then
    info.mqtt.subscriptions = {}
  end
  if not info.mqtt.last_announced then
    info.mqtt.last_announced = {}
  end


  if is_file_or_dir('/usr/share/homeautomation/parse_dhcp.lua') then
    local dhcp_class = require 'parse_dhcp'
    if dhcp_class then
      info.config.component.parse_dhcp = true
      dhcp_instance = dhcp_class.new()
      info.mqtt.callbacks['parse_dhcp'] = dhcp_instance
    end
  end

  if is_file_or_dir('/usr/share/homeautomation/outlets.lua') then
    local outlets_class = require 'outlets'
    if outlets_class then
      info.config.component.outlets = true
      outlets_instance = outlets_class:new()
      info.mqtt.callbacks['outlets'] = outlets_instance
    end
  end

  if is_file_or_dir('/usr/share/homeautomation/mosquitto_update.lua') then
    info.config.component.mosquitto_update = require 'mosquitto_update'
  end

  -- Load lua-mosquitto module if possible.
  local found = false
  for _, searcher in ipairs(package.searchers or package.loaders) do
    local loader = searcher('mosquitto')
    if type(loader) == 'function' then
      log('Using lua-mosquitto')
      found = true
      package.preload['mosquitto'] = loader
      mqtt_class = require "mosquitto"
      break
    end
  end
  -- Otherwise use our bash wrapper.
  if found == false then
    log('Using homeautomation_mqtt')
    mqtt_class = require 'homeautomation_mqtt'
  end

  mqtt_instance = mqtt_class.new()
  mqtt_instance.ON_CONNECT = mqtt_instance_ON_CONNECT
  mqtt_instance.ON_PUBLISH = mqtt_instance_ON_PUBLISH
  mqtt_instance.ON_MESSAGE = mqtt_instance_ON_MESSAGE


  if is_file_or_dir('/usr/share/homeautomation/control.lua') then
    local control_class = require 'control'
    if control_class then
      info.config.component.control = true
      control_instance = control_class:new()
      info.mqtt.callbacks['control'] = control_instance

    
    log('----------')

    local dhcp_watcher = FlowObjectMqttSubscribe:new{instance_name='dhcp_watcher', unique_id='_uid_1'}
    dhcp_watcher:add_general('subscribed_topic', 'dhcp/_announce')

    local registered_users = FlowObjectReadFile:new({instance_name='registered_users', unique_id='_uid_2'})
    registered_users:add_general('filename', '/etc/homeautomation/registered_users.conf')

    local consolidate = FlowObjectCombineData:new({instance_name='consolidate', unique_id='_uid_3'})
    consolidate:add_input('default_in', {primary_key_label = '_subject'})

    local someone_home = FlowObjectMapValues:new({instance_name='someone_home', unique_id='_uid_4'})
    someone_home:add_input('default_in', {label = '_user_name',
                                         rules = { _a = {match = '_missing',
                                                         action = '_drop'},
                                                   _b = {match = '_else',
                                                         action = '_forward'} } })

    local combine_users = FlowObjectAddData:new({instance_name='combine_users', unique_id='_uid_5'})
    combine_users:add_input('default_in', {primary_key_label = '_subject'})

    local modify_label = FlowObjectMapLabels:new({instance_name='modify_label', unique_id='_uid_6'})
    modify_label:add_input('default_in', {rules = { _a = {match = '_reachable',
                                                       action = '_string',
                                                       value = '_command'},
                                                 _b = {match = '_else',
                                                       action = '_drop'} } } )

    local modify_value = FlowObjectMapValues:new({instance_name='modify_value', unique_id='_uid_7'})
    modify_value:add_input('default_in', {label = '_command',
                                       rules = { _a = {match = 'true',
                                                       action = '_string',
                                                       value = 'on'},
                                                 _b = {match = 'false',
                                                       action = '_string',
                                                       value = 'off'} } })

    local tag_time = FlowObjectAddTime:new({instance_name='tag_time', unique_id='_uid_10'})
 
    local set_jess_warning_lamp = FlowObjectMqttPublish:new({instance_name='set_jess_warning_lamp', unique_id='_uid_9'})
    set_jess_warning_lamp:add_general('publish_topic', 'lighting/extension/jess_warning_lamp')

    registered_users:add_link(consolidate, 'default_in', 'default_out')
    dhcp_watcher:add_link(tag_time, 'default_in', 'default_out')
    tag_time:add_link(consolidate, 'default_in', 'default_out')
    consolidate:add_link(someone_home, 'default_in', 'default_out')
    someone_home:add_link(combine_users, 'default_in', 'default_out')
    combine_users:add_link(modify_label, 'default_in', 'default_out')

    modify_label:add_link(modify_value, 'default_in', 'default_out')
    modify_value:add_link(set_jess_warning_lamp, 'default_in', 'default_out')

  end
	end

  -- Set required files and directories.
  if not is_file_or_dir(WEB_DIR) then
    log('Creating ' .. WEB_DIR)
    mkdir(WEB_DIR)
  end

  if not is_file_or_dir(TEMP_DIR) then
    log('Creating ' .. TEMP_DIR)
    mkdir(TEMP_DIR)
    mkdir(TEMP_DIR .. 'mosquitto/')
  end

  if is_file_or_dir(WEB_DIR) and is_file_or_dir(TEMP_DIR) then
    os.execute('ln -s ' .. TEMP_DIR .. 'server.txt ' .. WEB_DIR .. 'server.txt')
  end

  -- Make sure the mosquitto.conf file has the required options set.
  -- TODO Enable websockets.
  local file_handle = io.open(MOSQUITTO_CONF, "a+")
  if file_handle then
    local found = false
    for line in file_handle:lines() do
      if string.find(line, '^include_dir%s+' .. TEMP_DIR .. 'mosquitto/') then
        found = true
      end
    end

    if found == false then
      log('Adding "include_dir" directive to ' .. TEMP_DIR .. 'mosquitto/')
      file_handle:write('\n# =================================================================\n')
      file_handle:write('# Appended by lua script.\n')  -- TODO get name of script programmatically.
      file_handle:write('# =================================================================\n')
      file_handle:write('include_dir ' .. TEMP_DIR .. 'mosquitto/\n')
    end

    file_handle:close()

    -- Need to make sure there is a config file in /tmp/homeautomation/mosquitto/ or mosquitto won't start.
    os.execute("touch /tmp/homeautomation/mosquitto/bridges.conf")
    os.execute("/etc/init.d/mosquitto start")
  end
end


-- This code needs to know if certain processes are running.
-- eg. Whether mosquitto is running will affect whether this code can use localhost as a broker or if it must look elsewhere.
function process_list()
    for process, value in pairs(info.host.processes) do
      local pid_command = "pgrep \"\\b" .. process .. "\\b\""  -- "\b" matches a word boundary.
      local handle = io.popen(pid_command)
      local result = handle:read("*line")
      local results = ''
      while result do
        if string.len(results) > 0 then
          results = results .. ',' 
        end
        results = results .. result
        result = handle:read("*line")
      end
      handle:close()

      info.host.processes[process].pid = results
      if info.host.processes[process].pid == nil then
        info.host.processes[process].pid = false
      end

      if match_file_or_dir('/etc/rc.d/S??' .. process) == 0 then
        info.host.processes[process].enabled = true
      else
        info.host.processes[process].enabled = false
      end
    end
end

-- Test if an address and port points to a valid MQTT broker.
function broker_test(broker, port)
  local test_mqtt_instance = mqtt_class.new()
  local return_value = test_mqtt_instance:connect(broker, port)
  test_mqtt_instance:disconnect()
  return return_value
end

-- Discover and test functionality of everything we suspect to be a Broker.
-- Ultimately choose a reachable Broker and mark it the active one.
function broker_list()
  local have_active

  -- Make localhost a broker if appropriate.
  if info.host.processes.mosquitto.enabled == true and info.host.processes.mosquitto.pid ~= "" and info.config.component.mosquitto_update then
    info.brokers.localhost = {}
    have_active = broker_test("127.0.0.1", 1883)
    info.brokers.localhost[1] = {address = "127.0.0.1", port = 1883, last_updated = os.time(), reachable = have_active, active = have_active}
  elseif info.brokers.localhost ~= nil and info.brokers.localhost[1] ~= nil then
    info.brokers.localhost[1].reachable = nil
    info.brokers.localhost[1].active = nil
  end

  -- Check if one of the brokers we already know about is the active one.
  -- Do this now so we don't change brokers as we learn about more.
  for broker, connections in pairs(info.brokers) do
    if type(connections) == 'table' then
      for index, connection in ipairs(connections) do
        local reachable = broker_test(connection.address, connection.port)
        info.brokers[broker][index].reachable = reachable
        if have_active then
          -- Already have an active broker.
          if connection.address ~= "127.0.0.1" then
            info.brokers[broker][index].active = nil
          end
        else
          -- Don't have an active broker yet.
          if reachable then
            have_active = true
            info.brokers[broker][index].active = true
          else
            info.brokers[broker][index].active = nil
          end
        end
      end
    end
  end

  -- TODO Investigate ways of speeding up the avahi-browse.
  -- It currently blocks for a second. Forking and writing the output to a file periodically..?
  local avahi_command = 'avahi-browse -rtp _mqtt._tcp 2> /dev/null | grep ^= | cut -d";" -f7,8,9'
  local handle = io.popen(avahi_command)
  local result = handle:read("*line")
  while result do
    local hostname, address, port = string.match(result, "^([%a%d-.]+).local;([%da-f:.]+);(%d+)$")
    if hostname ~= info.host.hostname then
      if not info.brokers[hostname] then
        info.brokers[hostname] = {}
      end

      local found_address
      for address_index, existing_address in ipairs(info.brokers[hostname]) do
        if existing_address.address == address then
          info.brokers[hostname][address_index].port = port
          info.brokers[hostname][address_index].last_updated = os.time()
          info.brokers[hostname][address_index].reachable = broker_test(address, port)
          found_address = true
          break
        end
      end
      if not found_address then
        info.brokers[hostname][#info.brokers[hostname] +1] = {address = address, port = port, last_updated = os.time(), reachable = broker_test(address, port)}
      end
    end
    result = handle:read("*line")
  end
  handle:close()
end

-- Get a list of network interfaces and addresses configured.
function local_network()
  local proc_handle = io.input('/proc/net/route')
  if proc_handle then
    for line in io.lines() do
      line = string.match(line, "^([%a%d-.]+)%s")
      if line and line ~= 'Iface' then    -- 'Iface' is the human readable label on the top line of /proc/net/route
        if not info.host.interfaces[line] then
          info.host.interfaces[line] = {}
        end
      end
    end
    proc_handle:close()

    for interface in pairs(info.host.interfaces) do
      local ifconfig_command = 'ifconfig ' .. interface .. ' | grep -E "HWaddr\|inet"'
      local ifconfig_handle = io.popen(ifconfig_command)
      local result = ifconfig_handle:read("*line")
      while result do
        local mac = string.match(result, "HWaddr%s([A-F%d:]+)")
        if mac then
          info.host.interfaces[interface].mac = mac
        end

        local ip = string.match(result, "inet6? addr:%s?([%da-f:.]+)")
        if not info.host.interfaces[interface].addresses then
          info.host.interfaces[interface].addresses = {}
        end
        local found_ip = false
        for i,a in ipairs(info.host.interfaces[interface].addresses) do
          if a == ip then
            found_ip = true
            break
          end
        end
        if not found_ip then
          info.host.interfaces[interface].addresses[#info.host.interfaces[interface].addresses +1] = ip
        end
        result = ifconfig_handle:read("*line")
      end
      ifconfig_handle:close()

    end
  end
end

-- Create a webpage of all the information contained in "info".
-- Currently used as a debugging aid but may be used later so we can create dashboards without access to MQTT.
function create_web_page(filename, data)
  --log('create_web_page')
  if info.host.processes.uhttpd.enabled == true then
    local handle = io.open(TEMP_DIR .. filename .. '.tmp', "w") 
    if handle then
      handle:write(data)
      handle:close()
      mv(TEMP_DIR .. filename .. '.tmp', TEMP_DIR .. filename)
    else
      log("Couldn't create: " .. TEMP_DIR .. filename .. '.tmp\n')
      log(_itterate_info(info, '', ''))
    end
  else
    log("uhttpd not running.")
    log(_itterate_info(info, '', ''))
  end
end

function _itterate_info(info_branch, key, output)
  if type(info_branch) == 'table' then
    local table_populated
    for name, value in pairs(info_branch) do
      table_populated = true
      if tostring(name) == '__index' then
        -- Pass
      elseif key ~= '' then
        output = _itterate_info(value, key .. '.' .. tostring(name), output)
      else
        output = _itterate_info(value, name, output)
      end
    end
    if table_populated == nil then
      local table_string = tostring(info_branch)
      table_string = table_string:gsub('^table: (.*)', '%1')
      output = output .. key .. ' : (table)' .. table_string .. '\r\n'
    end
  else
    output = output .. key .. ' : (' .. type(info_branch) .. ')' .. tostring(info_branch) .. '\r\n'
  end
  return output
end

-- Monitor the message bus.
-- Periodically return so we can perform other housekeeping duties before re-running this.
function poll_mosquitto(stop_at)
  repeat
    local loop_value = mqtt_instance:loop()
    if loop_value ~= true then
      for broker, connections in pairs(info.brokers) do
        if type(connections) == 'table' then
          for connection_id, connection in pairs(connections) do
            if connection.active then
              loop_value = mqtt_instance:connect(connection.address, connection.port)
              break
            end
          end
        end
      end
      if loop_value ~= true then
        -- Still not true which means no connections are marked active or connection.active is not actually active.
        info.brokers.ERROR = "No active broker found."
        log("Error: No active broker found.")
        return
      else
        info.brokers.ERROR = nil
      end
    end
  until os.time() >= stop_at
end

-- Main program loop.
function main()
  print('Starting.')
  for i,v in pairs(arg) do
    if v == '-d' then
      DEBUG = true
      print('  debugging on.')
    end
  end
  print()

  run = true
  initilize()

  while run do
    log('tick', info.config.last_updated)
    process_list()
    local_network()
    broker_list()

    if info.config.component.outlets ~= nil then
      outlets_instance:read_config()
    end

    if info.config.component.mosquitto_update then
      update_mosquitto_config()
    end
    
    if info.config.component.parse_dhcp then
      dhcp_instance:read_dhcp()
    end

    --if info.config.component.control then
    --end

    create_web_page('server.txt', _itterate_info(info, '', ''))
    
    poll_mosquitto(info.config.last_updated + info.config.update_delay)
    info.config.last_updated = os.time()
  end
end

main()
