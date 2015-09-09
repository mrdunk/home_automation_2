#!/usr/bin/lua

--[[

]]--


local base_web_dir = '/www/'
local web_dir = '/www/info/'
local mosquitto_pub = '/usr/bin/mosquitto_pub'

local info = {}
info.processes = {['mosquitto'] = {}, 
                  ['avahi-daemon'] = {},
                  ['dropbear'] = {},
                  ['test'] = {}}
info.brokers = {}
info.config = {update_delay = 1,
               interfaces = {}}

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

function hostname()
    local handle = io.popen("uname -snr")
    local uname = handle:read("*line")
    handle:close()
    info.hostname = string.match(uname, "[%w]+[%s]([%w%p]+)[%s][%w%p]+")
end

function process_list()
    for process, value in pairs(info.processes) do
      local pid_command = "pgrep " .. process
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
  local command = mosquitto_pub .. ' -h ' .. broker .. ' -p ' .. port .. ' -t test/test -m test'
  return os.execute(command) == 0
end

function broker_list()
  for hostname in pairs(info.brokers) do
    for address_index in pairs(info.brokers[hostname]) do
      info.brokers[hostname][address_index].last_updated = info.brokers[hostname][address_index].last_updated + info.config.update_delay
    end
  end

  local avahi_command = 'avahi-browse -rtp _mqtt._tcp | grep ^= | cut -d";" -f7,8,9'
  local handle = io.popen(avahi_command)
  local result = handle:read("*line")
  while result do
    local hostname, address, port = string.match(result, "^([%a%d-.]+).local;([%da-f:.]+);(%d+)$")
    if hostname ~= info.hostname then
      if not info.brokers[hostname] then
        info.brokers[hostname] = {}
      end

      local found_address = false
      for address_index, existing_address in ipairs(info.brokers[hostname]) do
        if existing_address.address == address then
          info.brokers[hostname][address_index].port = port
          info.brokers[hostname][address_index].last_updated = 0
          info.brokers[hostname][address_index].reachable = broker_test(address, port)
          found_address = true
          break
        end
      end
      if found_address == false then
        info.brokers[hostname][#info.brokers[hostname] +1] = {address = address, port = port, last_updated = 0, reachable = broker_test(address, port)}
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
  if is_file_or_dir(base_web_dir) and not is_file_or_dir(web_dir) then
    print('Creating ' .. web_dir)
    mkdir(web_dir)
  end

  local handle = io.open(web_dir .. 'tmp.txt', "w") 
  if handle then
    handle:write(itterate_info(info, '', ''))
    handle:close()
    mv(web_dir .. 'tmp.txt', web_dir .. 'server.txt')
  else
    print("Couldn't open: " .. web_dir .. 'tmp.txt\n')
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
  local config = {}

  -- Parse existing config.
  local file_handle = io.open("/tmp/mosquitto/bridges.conf", "r")
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
    print('No file: /tmp/mosquitto/bridges.conf')
    mkdir("/tmp/mosquitto/")
  end

  -- Compare to detected brokers on network.
  local new_file = false
  for broker, connections in pairs(info.brokers) do
    print(broker, connections)
    local reachable_connection, active_connection
    for connection_id, connection in pairs(connections) do
      if connection.reachable == true then
        reachable_connection = connection
      end
      if connection.reachable == true and config[connection.address] == connection.port then
        connection.active = true
        active_connection = true
      else
        connection.active = false
      end
      print("", broker, connection.address, config[connection.address], connection.port)
    end

    -- Since none of the connections are in the file, mark one of them active.
    if active_connection == nil and reachable_connection ~= nil then
      reachable_connection.active = "pending"
      new_file = true
    end
  end

  -- Write a new file if it needs done.
  if new_file == true then
    file_handle = io.open("/tmp/mosquitto/tmp.conf", "w")
    if file_handle then
      for broker, connections in pairs(info.brokers) do
        for connection_id, connection in pairs(connections) do
          if connection.active ~= false then
            file_handle:write('connection ' .. info.hostname .. '_to_' .. broker .. '\n')
            file_handle:write('address ' .. connection.address .. ':' .. connection.port .. '\n')
            file_handle:write('topic # in 1 homeautomation/bridges/ homeautomation/devices/ \n\n')
          end
        end
      end
      file_handle:close()
      mv("/tmp/mosquitto/tmp.conf", "/tmp/mosquitto/bridges.conf")
    end
  end
end

function main()
  run = true

  while run do
    print('tick')
    hostname()
    process_list()
    local_network()
    broker_list()
    create_web_page()
    update_mosquitto_config()
    os.execute("sleep " .. info.config.update_delay)
  end
end

main()
