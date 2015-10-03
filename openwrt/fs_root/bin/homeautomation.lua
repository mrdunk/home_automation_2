#!/usr/bin/lua

--[[

  Topic format:
    unique_ID/broker_level/roll/address_1[/address_2[/address_3[...] ] ]
  where:
    unique_ID is an identifier unique to this instillation.
    broker_level == 0 for a client, broker_level == 1 for a broker. Further values may be used for further levels of broker recursion in the future.
    roll is an identifier for the type of operation this topic describes. eg. "lighting" or "heating".
    address_X describe the actual equipment being addressed by the Topic. eg. "dunks_house/kitchen/worktop/left" or "dunks_house/workshop/desk_lamp".

]]--

local DEBUG = true

package.path = package.path .. ';/usr/share/homeautomation/?.lua'

require 'os'


-- Load lua-mosquitto module if possible.
local found = false
for _, searcher in ipairs(package.searchers or package.loaders) do
  local loader = searcher('mosquitto')
  if type(loader) == 'function' then
    print('Using lua-mosquitto')
    found = true
    package.preload['mosquitto'] = loader
    mqtt = require "mosquitto"
    break
  end
end

-- Otherwise use our bash wrapper.
if found == false then
  print('Using homeautomation_mqtt')
  mqtt = require 'homeautomation_mqtt'
end


-- Constants
local WEB_DIR = '/www/info/'
local TEMP_DIR = '/tmp/homeautomation/'
local MOSQUITTO_CONF = '/etc/mosquitto/mosquitto.conf'
local POWER_SCRIPT_DIR = '/usr/share/homeautomation/power_commands/'

-- Globals
info = {}
local mqtt_client = mqtt.new()


function mqtt_client.ON_PUBLISH()
  --print("mqtt_client.ON_PUBLISH")
end

function mqtt_client.ON_MESSAGE(mid, topic, payload)
  if topic == nil or payload == nil then
    return
  end

  -- Only match alphanumeric characters and a very limited range of special characters here to prevent easy injection type attacks.
  local unique_ID, broker_level, roll, address = string.match(topic, "^([%w_%-]+)/([%w_%-]+)/([%w_%-]+)/([%w_%-/]+)")
  local command = string.match(payload, "^command%s*:%s*(%w+)")

  -- Now we have parsed topic and payload, lets remove the temptation to use them again.
  topic = nil
  payload = nil

  local topic_sections = {}
  local topic_section_counter = 1
  local topic_remainder = address
  while topic_remainder ~= "" do
    topic_sections[topic_section_counter], topic_remainder = string.match(topic_remainder, "([%w_%-]+)/?([%w_%-/]*)")
    topic_section_counter = topic_section_counter +1
  end

  for index, device in pairs(info.devices) do
    if (device.role == roll or "all" == roll) and "homeautomation" == unique_ID then
      local address_remainder = device.address
      local address_section
      local address_section_counter = 1
      local match = true
      while address_remainder ~= "" do
        address_section, address_remainder = string.match(address_remainder, "([%w_%-]+)/?([%w_%-/]*)")
        if topic_sections[address_section_counter] == "all" then
          -- All child nodes match
          break
        elseif topic_sections[address_section_counter] ~= address_section then
          match = false
        end
        address_section_counter = address_section_counter +1
      end
      if match == true then
        print(device.address .. " matches " .. address)
        if command == "on" then
          device_set_on(device)
        elseif command == "off" then
          device_set_off(device)
        elseif command == "solicit" then
          device_announce(device)
        end
      end
    end
  end
end

function mqtt_client.ON_CONNECT()
  print("mqtt_client.ON_CONNECT")
  if DEBUG then
    while #info.mqtt.subscriptions > 0 do
      table.remove(info.mqtt.subscriptions, #info.mqtt.subscriptions)
    end
    while #info.mqtt.last_announced > 0 do
      table.remove(info.mqtt.last_announced, #info.mqtt.last_announced)
    end
  end

  local subscribe_to = {}

  for k, device in pairs(info.devices) do
    local subscription = ""
    for address_section in string.gmatch(device.address, "[^/]+") do
      subscribe_to["homeautomation/+/" .. device.role .. subscription .. "/all"] = true
      subscribe_to["homeautomation/+/all" .. subscription .. "/all"] = true
      subscription = subscription .. "/" .. address_section
    end
    subscribe_to["homeautomation/+/" .. device.role .. subscription] = true
    subscribe_to["homeautomation/+/all" .. subscription] = true
  end

  local debug_counter = 1
  for subscription, v in pairs(subscribe_to) do
    print("Subscribing to: " .. subscription)
    mqtt_client:subscribe(subscription)
    if DEBUG then
      info.mqtt.subscriptions[debug_counter] = subscription
      debug_counter = debug_counter +1
    end
  end

  for k, device in pairs(info.devices) do
    device_announce(device)
  end
end


-- Test if a path exists on the file system.
function is_file_or_dir(fn)
    return os.rename(fn, fn)
end

function mkdir(dir)
  return os.execute("mkdir -p " .. dir)
end

-- Move a file or directory.
function mv(source, dest)
  return os.rename(source, dest)
end

-- Test if a path exists on the file system. Wild cards can be used.
function match_file_or_dir(fn)
  return os.execute("[ -e  " .. fn .. " ]")
end


local trigger_dhcp
if is_file_or_dir('/usr/share/homeautomation/trigger_dhcp.lua') then
  trigger_dhcp = require 'trigger_dhcp'
end


-- Get the value a particular device is set to. eg. "on" or "off".
-- Works by calling a bash program that contains the necessary code to perform the operation.
-- The name of this bash program can be set in the main configuration file.
function device_get_value(device)
  -- TODO limit executable code in device.command.query to shell scripts in a limited directory.
  local device_tmp_filename = string.gsub(device.address, "/", "__")
  local handle = io.popen(POWER_SCRIPT_DIR .. device.command .. " " .. device_tmp_filename .. " query")
  if not handle then
    return nil
  end
  local ret_val = handle:read("*all")
  handle:close()

  return ret_val:match "^%s*(.-)%s*$"
end

-- Set a power management device to the "on" state.
-- Works by calling a bash program that contains the necessary code to perform the operation.
-- The name of this bash program can be set in the main configuration file.
function device_set_on(device)
  print("device_set_on: " .. device.address)
  local device_tmp_filename = string.gsub(device.address, "/", "__")
  local ret_val = os.execute(POWER_SCRIPT_DIR .. device.command .. " " .. device_tmp_filename .. " on")
  device_announce(device)
  return ret_val
end

-- Set a power management device to the "off" state.
-- Works by calling a bash program that contains the necessary code to perform the operation.
-- The name of this bash program can be set in the main configuration file.
function device_set_off(device)
  print("device_set_off: " .. device.address)
  local device_tmp_filename = string.gsub(device.address, "/", "__")
  local ret_val = os.execute(POWER_SCRIPT_DIR .. device.command .. " " .. device_tmp_filename .. " off")
  device_announce(device)
  return ret_val
end

-- Advertise the existence of a device over the message bus.
function device_announce(device)
  local value = device_get_value(device)
  print("Announcing: homeautomation/0/" .. device.role .. "/announce", device.role .. "/" .. device.address .. " : " .. value)
  mqtt_client:publish("homeautomation/0/" .. device.role .. "/announce", device.role .. "/" .. device.address .. " : " .. value)
  if DEBUG then
    local found_match
    for k, v in pairs(info.mqtt.last_announced) do
      if string.match(info.mqtt.last_announced[k], device.address .. " : ") then
        found_match = true
        info.mqtt.last_announced[k] = device.role .. "/" .. device.address .. " : " .. os.time()
      end
    end
    if not found_match then
      table.insert(info.mqtt.last_announced, device.role .. "/" .. device.address .. " : " .. os.time())
    end
  end
end

-- To be called first.
-- Initialize everything needed to run this program.
function initilize()
  -- The global "info" is the main data structure and contains all data
  -- which is to be passed from one iteration of this code to the next.
  -- The full contents of "info" are displayed on a webpage for debugging:
  -- http://$HOSTNAME/info/server.txt
  info = {}
  info.brokers = {}
  info.devices = {}
  info.host = {interfaces = {},
               processes = {}}
  info.host.processes = {['mosquitto'] = {},
                         ['avahi-daemon'] = {},
                         ['dropbear'] = {},
                         ['uhttpd'] = {}}
  info.config = {update_delay = 10}
  info.last_updated = os.time()

  -- The following data is not strictly required but is useful to know when debugging.
  if DEBUG then
    if not info.mqtt then
      info.mqtt = {}
    end
    if not info.mqtt.subscriptions then
      info.mqtt.subscriptions = {}
    end
    if not info.mqtt.last_announced then
      info.mqtt.last_announced = {}
    end
  end

  -- Set required files and directories.
  if not is_file_or_dir(WEB_DIR) then
    print('Creating ' .. WEB_DIR)
    mkdir(WEB_DIR)
  end

  if not is_file_or_dir(TEMP_DIR) then
    print('Creating ' .. TEMP_DIR)
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
      print('Adding "include_dir" directive to ' .. TEMP_DIR .. 'mosquitto/')
      file_handle:write('\n# =================================================================\n')
      file_handle:write('# Appended by lua script.\n')  -- TODO get name of script programmatically.
      file_handle:write('# =================================================================\n')
      file_handle:write('include_dir ' .. TEMP_DIR .. 'mosquitto/\n')
    end

    file_handle:close()
  end

  -- Need to make sure there is a config file in /tmp/homeautomation/mosquitto/ or mosquitto won't start.
  os.execute("touch /tmp/homeautomation/mosquitto/bridges.conf")
  os.execute("/etc/init.d/mosquitto start")
end

-- Return hostname of the host running this code.
function hostname()
  local handle = io.popen("uname -snr")
  local uname = handle:read("*line")
  handle:close()
  info.host.hostname = string.match(uname, "[%w]+[%s]([%w%p]+)[%s][%w%p]+")
end

-- This code needs to know if certain processes are running.
-- eg. Whether mosquitto is running will affect whether this code can use localhost as a broker or if it must look elsewhere.
function process_list()
    for process, value in pairs(info.host.processes) do
      local pid_command = "pgrep /" .. process .. "$"
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
  local test_mqtt_client = mqtt.new()
  return test_mqtt_client:connect(broker, port)
end

-- Discover and test functionality of everything we suspect to be a Broker.
-- Ultimately choose a reachable Broker and mark it the active one.
function broker_list()
  local have_active

  -- Make localhost a broker if appropriate.
  if info.host.processes.mosquitto.enabled == true and info.host.processes.mosquitto.pid ~= "" then
    if not info.brokers.localhost then
      info.brokers.localhost = {}
    end

    local found_address
    for address_index, existing_address in ipairs(info.brokers.localhost) do
      if existing_address.address == "127.0.0.1" then
        found_address = true
        info.brokers.localhost[address_index].port = 1883
        info.brokers.localhost[address_index].last_updated = os.time()
        info.brokers.localhost[address_index].reachable = broker_test("localhost", 1883)
        info.brokers.localhost[address_index].active = info.brokers.localhost[address_index].reachable
        have_active = info.brokers.localhost[address_index].reachable
      end
    end

    if not found_address then
      local reachable = broker_test("127.0.0.1", 1883)
      info.brokers.localhost[#info.brokers.localhost +1] = {address = "127.0.0.1", port = 1883, last_updated = os.time(), reachable = reachable, active = reachable}
      have_active = reachable
    end
  end

  -- Check if one of the brokers we already know about is the active one.
  -- Do this now so we don't change brokers as we learn about more.
  local reachable_broker
  for broker, connections in pairs(info.brokers) do
    for index, connection in ipairs(connections) do
      if connection.active then
        connection.reachable = broker_test(connection.address, connection.port)
        connection.active = connection.reachable
        have_active = connection.reachable
      end
      
      if reachable_broker == nil and connection.reachable then
        reachable_broker = connection
        if have_active == nil then
          print("Make this the active broker: ", connection.address)
          have_active = true
          connection.active = true
        end
      end
    end
  end

  -- TODO Investigate ways of speeding up the avahi-browse.
  -- It currently blocks for a second. Forking and writing the output to a file periodically..?
  local avahi_command = 'avahi-browse -rtp _mqtt._tcp | grep ^= | cut -d";" -f7,8,9'
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
      local ifconfig_command = 'ifconfig ' .. interface .. ' | grep "HWaddr\\|inet"'
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
function create_web_page()
  if info.host.processes.uhttpd.enabled == true then
    local handle = io.open(TEMP_DIR .. 'tmp.txt', "w") 
    if handle then
      handle:write(_itterate_info(info, '', ''))
      handle:close()
      mv(TEMP_DIR .. 'tmp.txt', TEMP_DIR .. 'server.txt')
    else
      print("Couldn't create: " .. TEMP_DIR .. 'tmp.txt\n')
      print(_itterate_info(info, '', ''))
    end
  else
    print("uhttpd not running.")
    print(_itterate_info(info, '', ''))
  end
end

function _itterate_info(info_branch, key, output)
  if type(info_branch) == 'number' or type(info_branch) == 'boolean' then
    output = output .. key .. ' : ' .. tostring(info_branch) .. '\r\n'
  elseif type(info_branch) == 'string' then
    if info_branch ~= '' then
      output = output .. key .. ' : ' .. info_branch .. '\r\n'
    end
  else
    for name, value in pairs(info_branch) do
      if key ~= '' then
        output = _itterate_info(value, key .. '.' .. name, output)
      else
        output = _itterate_info(value, name, output)
      end
    end
  end
  return output
end

-- Create a mosquitto config file with information about other brokers we intend to form bridges with.
function update_mosquitto_config()
  if info.host.processes['avahi-daemon'].enabled ~= true then
    return
  end
  if info.host.processes.mosquitto.enabled ~= true then
    return
  end

  local config = {}

  -- Parse existing config.
  local file_handle = io.open("/tmp/homeautomation/mosquitto/bridges.conf", "r")
  if file_handle then
    for line in file_handle:lines() do
      local key, content = string.match(line, "^(%a+)%s+(.+)%s*$")
      if key == 'address' then
        local address, port = string.match(content, "^([%da-f:.]+):(%d+)%s*$")
        if port == nil then 
          port = '1883'
        end
        config[address] = port
      end
    end
    file_handle:close()
  else
    print('No file: /tmp/homeautomation/mosquitto/bridges.conf')
  end

  -- Compare to detected brokers on network.
  local new_file = false
  for broker, connections in pairs(info.brokers) do
    local reachable_connection, in_file
    for connection_id, connection in pairs(connections) do
      if connection.reachable == true and broker ~= "localhost" then
        reachable_connection = connection
        if config[connection.address] == connection.port then
          -- Is already in file.
          in_file = true
          break
        end
      end
    end

    if reachable_connection and not in_file then
      -- Since none of the connections are in the file, it needs updated.
      new_file = true
    end
  
  end

  -- Write a new file if it needs done.
  if new_file == true then
    file_handle = io.open("/tmp/homeautomation/mosquitto/tmp.conf", "w")
    if file_handle then
      for broker, connections in pairs(info.brokers) do
        for connection_id, connection in pairs(connections) do
          if connection.reachable == true and broker ~= "localhost" then
            file_handle:write('connection ' .. info.host.hostname .. '_to_' .. broker .. '\n')
            file_handle:write('address ' .. connection.address .. ':' .. connection.port .. '\n')
            file_handle:write('topic # in 1 homeautomation/1/ homeautomation/0/ \n\n')
            break
          end
        end
      end
      file_handle:close()
      mv("/tmp/homeautomation/mosquitto/tmp.conf", "/tmp/homeautomation/mosquitto/bridges.conf")
      info.needs_reload = true
    end

    -- And restart mosquitto.
    if info.needs_reload == true then
      print("restarting mosquitto")
      info.needs_reload = os.execute("/etc/init.d/mosquitto restart") ~= 0
    end
  end
end

-- Read the configuration file for connected devices.
local read_client_config_first_loop = true
function read_client_config()
  local client_config = "/etc/homeautomation/client_devices.conf"
  if not is_file_or_dir(client_config) then
    if read_client_config_first_loop == true then
      print(client_config .. " does not exist. No client configuration.")
      read_client_config_first_loop = nil
    end
    return
  end

  info.devices.last_updated = os.time()
  for k in next,info.devices do info.devices[k] = nil end -- Clear table.

  -- TODO only need to do this if file has been modified since last read.
  -- TODO Need to change subscriptions if anything has changed.

  local file_handle = io.open(client_config, "r")
  if file_handle then
    local dev_role, dev_address, dev_command
    for line in file_handle:lines() do
      local tmp, tmp2
      tmp = string.match(line, "^%s*client\.device\.address%s*:%s*(.+)%s*$")
      if tmp then
        if dev_address and dev_role then
          -- Save previous record
          info.devices[#info.devices +1] = {address = dev_address, role = dev_role, command = dev_command}
        end
        dev_address = tmp
        dev_role = nil
      end
      tmp = string.match(line, "^%s*client\.device\.role%s*:%s*(.+)%s*$")
      if tmp then
        if not dev_address then
          print("Error in " .. client_config .. ". client.device.address not specified before \"" .. line .. "\"")
          return
        end
        dev_role = tmp
      end
      tmp = string.match(line, "^%s*client\.device\.command%s*:%s*(.+)%s*$")
      if tmp then
        if not dev_address then
          print("Error in " .. client_config .. ". client.device.address not specified before \"" .. line .. "\"")
          return
        end
        if not dev_role then
          print("Error in " .. client_config .. ". client.device.role not specified before \"" .. line .. "\"")
          return
        end
        dev_command = tmp
      end
    end
    file_handle:close()
    if dev_address and dev_role then
      info.devices[#info.devices +1] = {address = dev_address, role = dev_role, command = dev_command}
    end
  end
end

-- Monitor the message bus.
-- Periodically return so we can perform other housekeeping duties before re-running this.
function poll_mosquitto(stop_at)
  repeat
    local loop_value = mqtt_client:loop()
    if loop_value ~= true then
      for broker, connections in pairs(info.brokers) do
        for connection_id, connection in pairs(connections) do
          if connection.active then
            loop_value = mqtt_client:connect(connection.address, connection.port)
            break
          end
        end
      end
      if loop_value ~= true then
        -- Still not true which means no connections are marked active or connection.active is not actually active.
        print("Error: No active broker found.")
        return
      end
    end
  until os.time() >= stop_at
end

-- Main program loop.
function main()
  run = true
  initilize()

  while run do
    print('tick', info.last_updated)
    hostname()
    process_list()
    local_network()
    broker_list()
    read_client_config()

    update_mosquitto_config()
    create_web_page()

    if trigger_dhcp ~= nil then
      read_dhcp()
    end
    
    poll_mosquitto(info.last_updated + info.config.update_delay)
    info.last_updated = os.time()
  end
end

main()
