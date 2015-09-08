#!/usr/bin/lua

--[[

]]--


local base_web_dir = '/www/'
local web_dir = '/www/info/'

local info = {}
info.processes = {['mosquitto'] = false, 
                  ['avahi-daemon'] = false,
                  ['dropbear'] = false}
info.brokers = {}
info.config = {update_delay = 1,
               interfaces = {}}

function isdir(fn)
    return os.rename(fn, fn)
end

function mkdir(dir)
  return os.execute("mkdir -p " .. dir)
end

function mv(source, dest)
  return os.rename(source, dest)
end

hostname = function()
    local handle = io.popen("uname -snr")
    local uname = handle:read("*line")
    handle:close()
    info.hostname = string.match(uname, "[%w]+[%s]([%w%p]+)[%s][%w%p]+")
end

process_list = function()
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

      info.processes[process] = results
      if info.processes[process] == nil then
        info.processes[process] = false
      end
    end
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
    if not info.brokers[hostname] then
      info.brokers[hostname] = {}
    end

    local found_address = false
    for address_index, existing_address in ipairs(info.brokers[hostname]) do
      if existing_address.address == address then
        info.brokers[hostname][address_index].port = port
        info.brokers[hostname][address_index].last_updated = 0
        found_address = true
        break
      end
    end
    if found_address == false then
      info.brokers[hostname][#info.brokers[hostname] +1] = {address = address, port = port, last_updated = 0}
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
      print(interface)
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

create_web_page = function()
  if isdir(base_web_dir) and not isdir(web_dir) then
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

itterate_info = function(info_branch, key, output)
  if type(info_branch) == 'number' then
    output = output .. key .. ' : ' .. info_branch .. '\r\n'
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

main = function()
  run = true

  while run do
    print('tick')
    hostname()
    process_list()
    local_network()
    broker_list()
    create_web_page()
    os.execute("sleep " .. info.config.update_delay)
  end
end

main()
