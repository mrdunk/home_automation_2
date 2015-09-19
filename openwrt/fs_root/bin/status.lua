#!/usr/bin/lua

--[[

  Topic format:
    unique_ID/broker_level/roll/address_1[/address_2[/address_3[...] ] ]
  where:
    unique_ID is an identifier unique to this instilation.
    broker_level == 0 for a client, broker_level == 1 for a broker. Further values may be used for further levels of broker recursion in the future.
    roll is an identifier for the type of operation this topic describes. eg. "lighting" or "heating".
    address_X describe the actual equipment being addressed by the Topic. eg. "dunks_house/kitchen/worktop/left" or "dunks_house/workshop/desk_lamp".

]]--

local DEBUG = true

package.path = package.path .. ';/usr/share/homeautomation/?.lua'


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


local web_dir = '/www/info/'
local temp_dir = '/tmp/homeautomation/'
local mosquitto_pub = '/usr/bin/mosquitto_pub'
local mosquitto_conf = '/etc/mosquitto/mosquitto.conf'

local info = {}
info.processes = {['mosquitto'] = {}, 
                  ['avahi-daemon'] = {},
                  ['dropbear'] = {},
                  ['uhttpd'] = {}}
info.brokers = {}
info.clients = {}
info.clients.device = {}
info.config = {update_delay = 10,
               interfaces = {}}


local mqtt_client = mqtt.new()

function mqtt_client.ON_PUBLISH()
  print("mqtt_client.ON_PUBLISH")
end

function mqtt_client.ON_MESSAGE(mid, topic, payload)
  print(mid, topic, payload)

  local unique_ID, broker_level, roll, address = string.match(topic, "^([%w_%-]+)/([%w_%-]+)/([%w_%-]+)/([%w_%-/]+)")
  print(unique_ID, broker_level, roll, address)

  local command = string.match(payload, "^command%s*:%s*(%w+)")

  local topic_sections = {}
  local topic_section_counter = 1
  local topic_remainder = address
  while topic_remainder ~= "" do
    topic_sections[topic_section_counter], topic_remainder = string.match(topic_remainder, "([%w_%-]+)/?([%w_%-/]*)")
    topic_section_counter = topic_section_counter +1
  end

  for index, device in pairs(info.clients.device) do
    if device.role == roll and "homeautomation" == unique_ID then
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
        print(device.address .. " matches " .. topic)
        if command == "on" then
          device_set_on(device)
        elseif command == "off" then
          device_set_off(device)
        end
      end
    end
  end
end

function mqtt_client.ON_CONNECT()
  print("mqtt_client.ON_CONNECT")

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
    while #info.mqtt.subscriptions > 0 do
      table.remove(info.mqtt.subscriptions, #info.mqtt.subscriptions)
    end
    while #info.mqtt.last_announced > 0 do
      table.remove(info.mqtt.last_announced, #info.mqtt.last_announced)
    end
  end


  local subscribe_to = {}

  for k, device in pairs(info.clients.device) do
    local subscription = "homeautomation/+/" .. device.role
    for address_section in string.gmatch(device.address, "[^/]+") do
      subscribe_to[subscription .. "/all"] = true
      subscription = subscription .. "/" .. address_section
    end
    subscribe_to[subscription] = true
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

  for k, device in pairs(info.clients.device) do
    device_announce(device)
  end
end


function is_file_or_dir(fn)
    return os.rename(fn, fn)
end

function mkdir(dir)
  return os.execute("mkdir -p " .. dir)
end

function mv(source, dest)
  return os.rename(source, dest)
end

function match_file_or_dir(fn)
  return os.execute("[ -e  " .. fn .. " ]")
end

function device_get_value(device)
  -- TODO limit executable code in device.command.query to shell scripts in a limited directory.
  local handle = io.popen(device.command.query)
  if not handle then
    return nil
  end
  local ret_val = handle:read("*all")
  handle:close()

  return ret_val:match "^%s*(.-)%s*$"
end

function device_set_on(device)
  print("device_set_on: " .. device.address)
  local ret_val = os.execute(device.command.on)
  device_announce(device)
  return ret_val
end

function device_set_off(device)
  print("device_set_off: " .. device.address)
  local ret_val =  os.execute(device.command.off)
  device_announce(device)
  return ret_val
end

function device_announce(device)
  local value = device_get_value(device)
  print("Announcing: " .. device.role .. "/" .. device.address .. "  value: " .. value)
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

function initilize()
  info.last_updated = os.time()

  if not is_file_or_dir(web_dir) then
    print('Creating ' .. web_dir)
    mkdir(web_dir)
  end

  if not is_file_or_dir(temp_dir) then
    print('Creating ' .. temp_dir)
    mkdir(temp_dir)
    mkdir(temp_dir .. 'mosquitto/')
  end

  if is_file_or_dir(web_dir) and is_file_or_dir(temp_dir) then
    os.execute('ln -s ' .. temp_dir .. 'server.txt ' .. web_dir .. 'server.txt')
  end

  local file_handle = io.open(mosquitto_conf, "a+")
  if file_handle then
    local found = false
    for line in file_handle:lines() do
      if string.find(line, '^include_dir%s+' .. temp_dir .. 'mosquitto/') then
        found = true
      end
    end

    if found == false then
      print('Adding "include_dir" directive to ' .. temp_dir .. 'mosquitto/')
      file_handle:write('\n# =================================================================\n')
      file_handle:write('# Appended by lua script.\n')  -- TODO get name of script programmatically.
      file_handle:write('# =================================================================\n')
      file_handle:write('include_dir ' .. temp_dir .. 'mosquitto/\n')
    end

    file_handle:close()
  end
end

function hostname()
    local handle = io.popen("uname -snr")
    local uname = handle:read("*line")
    handle:close()
    info.hostname = string.match(uname, "[%w]+[%s]([%w%p]+)[%s][%w%p]+")
end

function process_list()
    for process, value in pairs(info.processes) do
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

      info.processes[process].pid = results
      if info.processes[process].pid == nil then
        info.processes[process].pid = false
      end

      if match_file_or_dir('/etc/rc.d/S??' .. process) == 0 then
        info.processes[process].enabled = true
      else
        info.processes[process].enabled = false
      end
    end
end

function broker_test(broker, port)
  local test_mqtt_client = mqtt.new()
  return test_mqtt_client:connect(broker, port)
end

function broker_list()
  local have_active

  -- Make localhost a broker if appropriate.
  if info.processes.mosquitto.enabled == true and info.processes.mosquitto.pid ~= "" then
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
    if hostname ~= info.hostname then
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

function local_network()
  local proc_handle = io.input('/proc/net/route')
  if proc_handle then
    for line in io.lines() do
      line = string.match(line, "^([%a%d-.]+)%s")
      if line and line ~= 'Iface' then    -- 'Iface' is the human readable label on the top line of /proc/net/route
        if not info.config.interfaces[line] then
          info.config.interfaces[line] = {}
        end
      end
    end
    proc_handle:close()

    for interface in pairs(info.config.interfaces) do
      local ifconfig_command = 'ifconfig ' .. interface .. ' | grep "HWaddr\\|inet"'
      local ifconfig_handle = io.popen(ifconfig_command)
      local result = ifconfig_handle:read("*line")
      while result do
        local mac = string.match(result, "HWaddr%s([A-F%d:]+)")
        if mac then
          info.config.interfaces[interface].mac = mac
        end

        local ip = string.match(result, "inet6? addr:%s?([%da-f:.]+)")
        if not info.config.interfaces[interface].addresses then
          info.config.interfaces[interface].addresses = {}
        end
        local found_ip = false
        for i,a in ipairs(info.config.interfaces[interface].addresses) do
          if a == ip then
            found_ip = true
            break
          end
        end
        if not found_ip then
          info.config.interfaces[interface].addresses[#info.config.interfaces[interface].addresses +1] = ip
        end
        result = ifconfig_handle:read("*line")
      end
      ifconfig_handle:close()

    end
  end
end

function create_web_page()
  if info.processes.uhttpd.enabled == true then
    local handle = io.open(temp_dir .. 'tmp.txt', "w") 
    if handle then
      handle:write(itterate_info(info, '', ''))
      handle:close()
      mv(temp_dir .. 'tmp.txt', temp_dir .. 'server.txt')
    else
      print("Couldn't create: " .. temp_dir .. 'tmp.txt\n')
      print(itterate_info(info, '', ''))
    end
  else
    print("uhttpd not running.")
    print(itterate_info(info, '', ''))
  end
end

function itterate_info(info_branch, key, output)
  if type(info_branch) == 'number' or type(info_branch) == 'boolean' then
    output = output .. key .. ' : ' .. tostring(info_branch) .. '\r\n'
  elseif type(info_branch) == 'string' then
    if info_branch ~= '' then
      output = output .. key .. ' : ' .. info_branch .. '\r\n'
    end
  else
    for name, value in pairs(info_branch) do
      if key ~= '' then
        output = itterate_info(value, key .. '.' .. name, output)
      else
        output = itterate_info(value, name, output)
      end
    end
  end
  return output
end

function update_mosquitto_config()
  if info.processes['avahi-daemon'].enabled ~= true then
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
      if connection.reachable == true then
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
          if connection.reachable == true then
            file_handle:write('connection ' .. info.hostname .. '_to_' .. broker .. '\n')
            file_handle:write('address ' .. connection.address .. ':' .. connection.port .. '\n')
            file_handle:write('topic # in 1 homeautomation/bridges/ homeautomation/devices/ \n\n')
            break
          end
        end
      end
      file_handle:close()
      mv("/tmp/homeautomation/mosquitto/tmp.conf", "/tmp/homeautomation/mosquitto/bridges.conf")
      info.needs_reload = true
    end
  end
end

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

  info.clients.last_updated = os.time()
  for k in next,info.clients.device do info.clients.device[k] = nil end -- Clear table.

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
          info.clients.device[#info.clients.device +1] = {address = dev_address, role = dev_role, command = dev_command}
        end
        dev_address = tmp
        dev_role = nil
        dev_command = {}
      end
      tmp = string.match(line, "^%s*client\.device\.role%s*:%s*(.+)%s*$")
      if tmp then
        if not dev_address then
          print("Error in " .. client_config .. ". client.device.address not specified before \"" .. line .. "\"")
          return
        end
        dev_role = tmp
      end
      tmp, tmp2 = string.match(line, "^%s*client\.device\.command\.(.+)%s*:%s*(.+)%s*$")
      if tmp then
        if not dev_address then
          print("Error in " .. client_config .. ". client.device.address not specified before \"" .. line .. "\"")
          return
        end
        if not dev_role then
          print("Error in " .. client_config .. ". client.device.role not specified before \"" .. line .. "\"")
          return
        end
        dev_command[tmp] = tmp2
      end
    end
    file_handle:close()
    if dev_address and dev_role then
      info.clients.device[#info.clients.device +1] = {address = dev_address, role = dev_role, command = dev_command}
    end
  end
end

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
    
    poll_mosquitto(info.last_updated + info.config.update_delay)
    info.last_updated = os.time()
  end
end

main()
