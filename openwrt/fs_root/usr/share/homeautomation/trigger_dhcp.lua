#!/usr/bin/lua

--[[  ]]--

local DEVICE_CONFIG = '/etc/homeautomation/trigger_dhcp.conf'
local DHCP_FILE = '/tmp/dhcp.leases'


function read_dhcp()
  -- TODO Determine if files have changed before going to this effort.

  local file_handle = io.open(DEVICE_CONFIG, "r")
  if not file_handle then
    return
  end

  if not info.trigger_dhcp then
    info.trigger_dhcp = {}
  end

  local key, value, mac, google_id, display_name, image, update, found

  for line in file_handle:lines() do
    key, value = string.match(line, "^%s*trigger_dhcp\.([%a_]+)%s*:%s*(.+)%s*$")
    if key then
      if key == 'mac' then
        mac = value
      elseif key == 'google_id' then
        google_id = value
      elseif key == 'display_name' then
        display_name = value
      elseif key == 'image' then
        image = value
      else
        print ('Error: unknown key: ' .. key)
      end

      if mac and google_id and display_name and image then
        found = nil
        for index, trigger_dhcp in pairs(info.trigger_dhcp) do
          if trigger_dhcp.mac == mac then
            info.trigger_dhcp[index].in_file = true
            found = true
            -- Maybe update this one.
            if trigger_dhcp.google_id ~= google_id then
              update = true
              info.trigger_dhcp[index].google_id = google_id
            end
            if trigger_dhcp.display_name ~= display_name then
              update = true
              info.trigger_dhcp[index].display_name = display_name
            end
            if trigger_dhcp.image ~= image then
              update = true
              info.trigger_dhcp[index].image = image
            end
          end
        end
        if not found then
          info.trigger_dhcp[#info.trigger_dhcp +1] = {mac = mac, google_id = google_id, display_name = display_name, image = image, in_file = true}
          update = true
        end
        mac = nil
        google_id = nil
        display_name = nil
        image = nil
      end
    end
  end
  file_handle:close()


  file_handle = io.open(DHCP_FILE, "r")
  if file_handle then
    for line in file_handle:lines() do
      local mac, address, name = string.match(line, "^%s*%d+%s+([%x:]+)%s+([%d\.]+)%s+([%w_-%*]+)")
      if name == '*' then
        name = ''
      end
      for index, trigger_dhcp in pairs(info.trigger_dhcp) do
        if trigger_dhcp.mac == mac then
          info.trigger_dhcp[index].address = address
          if name ~= '' then 
            info.trigger_dhcp[index].trigger_dhcp_name = name
          end
        end
      end
    end
    file_handle:close()
  end

  for index, trigger_dhcp in pairs(info.trigger_dhcp) do
    if info.trigger_dhcp[index].address and os.execute('ping -c1 -W1 ' .. info.trigger_dhcp[index].address .. ' 1> /dev/null') == 0 then
      -- Is reachable.
      if info.trigger_dhcp[index].reachable ~= true then
        info.trigger_dhcp[index].reachable = true
        update = true
      end
    else
      -- Is not reachable.
      if info.trigger_dhcp[index].reachable == true then
        info.trigger_dhcp[index].reachable = nil
        update = true
      end
    end
  end

  local delete_list = {}
  for index, trigger_dhcp in pairs(info.trigger_dhcp) do
    if not info.trigger_dhcp[index].in_file then
      table.insert(delete_list, index)
    else
      info.trigger_dhcp[index].in_file = nil
    end
  end
  for index, delete_this in pairs(delete_list) do
    print('Removing:', info.trigger_dhcp[delete_this].mac)
    table.remove(delete_list, delete_this)
    update = true
  end

  print('#', update)

  return
end
