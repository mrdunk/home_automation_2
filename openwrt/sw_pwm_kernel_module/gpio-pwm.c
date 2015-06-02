/*

The MIT License (MIT)

Copyright (c) <year> <copyright holders>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

/* gpio-pwm.c
 *
 * Linux Kernel module to provide PWM on a GPIO pin.
 *
 * At the time of writing drivers/pwm/gpio.c would not build for OpenWRT Chaos
 * Calmer so i wrote this.
 * It is my first attempt at a Kernel module so treat it with caution.
 *
 * Usage:
 *   When you load the module the following files are created:
 *     /sys/class/sw_pwm/register_gpio
 *   and
 *     /sys/class/sw_pwm/unregister_gpio
 *
 *   To register an IO pin with the module do the following:
 *     $ echo $GPIO_PIN_NUMBER > /sys/class/sw_pwm/register_gpio
 *   You will now see a new file in /sys/class/sw_pwm/ matching the GPIO pin number.
 *
 *   To set the pin doing GPIO stuff:
 *     $ echo $PWM_VALUE > /sys/class/sw_pwm/pwm_$GPIO_PIN_NUMBER
 *
 *   You can see what pins are registered and their PWM values by reading /sys/class/sw_pwm/register_gpio:
 *     $ cat /sys/class/sw_pwm/register_gpio
 *
 *   You can register a maximum number of GPIO pins defined by MAX_SW_PWMS.
 *
 */

#include <linux/module.h>
#include <linux/platform_device.h>
#include <linux/workqueue.h>
#include <linux/gpio.h>
#include <linux/delay.h>

// Maximum number of GPIO that can be used with this module.
// See comment below.
#define MAX_SW_PWMS 5

// Modules Workqueue will exit if this global is cleared.
int running = 1;

static struct class gpio_actions;
static ssize_t pwm_show(struct class *cls, struct class_attribute *attr, char *buf);
static ssize_t pwm_store(struct class *cls, struct class_attribute *attr, const char *buf, size_t count);


// Workqueue initilisation
static void pwm_handler(struct work_struct *w);
static struct workqueue_struct *wq = 0;
static DECLARE_WORK(mykmod_work, pwm_handler);


// Data relating to a single PWM pin.
struct sw_pwm {
    char name[16];   // Filename in /sys/class/sw_pwm/. Takes the format pwm_$GPIO_PIN_NUMBER so should never exceed 16.
    int gpio;        // GPIO pin number.
    int pwm_setting; // The PWM value of the pin. 0-255. 0 = off. 255 = 100% duty cycle.
    struct class_attribute class_attr_pwm;  // Container for sysfs data.
};


// TODO. Rather than use kmalloc to dynamically assign instances of this struct
// i'm just pre-allocating a few.
// Once MAX_SW_PWMS have been used, no more GPIO can be registered with this
// module.
static struct sw_pwm pwm_value[MAX_SW_PWMS];


// Handle the PWM.
// This function is running the whole time the module is loaded.
static void pwm_handler(struct work_struct *w)
{
    int i, next_action, current_time = 0;

    pr_info("pwm_handler");
    while(running){
        current_time = 0;
        next_action = 255;

        for(i = 0; i < MAX_SW_PWMS; ++i){
            if(pwm_value[i].pwm_setting){
                // Enable pin.
                gpio_set_value(pwm_value[i].gpio, 1);   // Turn on GPIO pin.
                if(pwm_value[i].pwm_setting < next_action){
                    next_action = pwm_value[i].pwm_setting;
                }
            }
        }
        while(current_time < 255){
            usleep_range((long int)10 * (next_action - current_time), (long int)10 * (1 + next_action - current_time));
            current_time = next_action;
            next_action = 255;
            for(i = 0; i < MAX_SW_PWMS; ++i){
                if(pwm_value[i].pwm_setting == current_time){
                    // Disable pin.
                    gpio_set_value(pwm_value[i].gpio, 0);   // Turn off GPIO pin.
                } else if(pwm_value[i].pwm_setting < next_action && pwm_value[i].pwm_setting > current_time){
                    next_action = pwm_value[i].pwm_setting;
                }
            }
        }
    }
}


// Called when the file /sys/class/sw_pwm/register_gpio is read.
static ssize_t register_gpio_show(struct class *cls, struct class_attribute *attr, char *buf)
{
    int i;
    ssize_t return_value = 0;
    for(i = 0; i < MAX_SW_PWMS; ++i){
        if(pwm_value[i].gpio >= 0){
            return_value += sprintf(buf + return_value, "%d\tname: %s\tgpio: %d\tpwm: %d\n", i, pwm_value[i].name, pwm_value[i].gpio, pwm_value[i].pwm_setting);
        }
    }

    return return_value;
}

// Called when the file /sys/class/sw_pwm/register_gpio is written to.
static ssize_t register_gpio_store(struct class *cls, struct class_attribute *attr, const char *buf, size_t count)
{
    int gpio = 0;
    int i;
    int found_space = -1;
    int status;

    sscanf(buf, "%du", &gpio);
    //printk(KERN_INFO "register_gpio_store\t%d\n", gpio);

    for(i = 0; i < MAX_SW_PWMS; ++i){
        if(pwm_value[i].gpio == gpio){
            found_space = -1;
            break;
        }
        if(pwm_value[i].gpio < 0 && found_space < 0){
            found_space = i;
        }
    }
    if(found_space >= 0 && gpio_is_valid(gpio)){
        // Configure GPIO hardware.
        status = gpio_direction_output(gpio, 0);
        if (status < 0){
            printk("Setting GPIO %d direction failed.", gpio);
            return count;
        }

        // Register gpio pin.
        pwm_value[found_space].gpio = gpio;
        sprintf(pwm_value[found_space].name, "pwm_%d", pwm_value[found_space].gpio);

        pwm_value[found_space].class_attr_pwm.attr.name = pwm_value[found_space].name;
        pwm_value[found_space].class_attr_pwm.attr.mode = 0644;
        pwm_value[found_space].class_attr_pwm.show = pwm_show;
        pwm_value[found_space].class_attr_pwm.store = pwm_store;

        status = class_create_file(&gpio_actions, &(pwm_value[found_space].class_attr_pwm));
        if (status < 0){
            printk("Registering Class Failed\n");
        }
    }
    return count;
}

// Called when the file /sys/class/sw_pwm/unregister_gpio is written to.
static ssize_t unregister_gpio_store(struct class *cls, struct class_attribute *attr, const char *buf, size_t count)
{
    int gpio = 0;
    int i;
    sscanf(buf, "%du", &gpio);
    //printk(KERN_INFO "unregister_gpio_store\t%d\n", gpio);

    for(i = 0; i < MAX_SW_PWMS; ++i){
        if(pwm_value[i].gpio == gpio){
            pwm_value[i].gpio = -1;
            class_remove_file(&gpio_actions, &(pwm_value[i].class_attr_pwm));
        }
    }
    return count;
}

 
static struct class_attribute class_attr_gpio[] = { __ATTR(register_gpio, 0644, register_gpio_show, register_gpio_store), 
                                               __ATTR(unregister_gpio, 0644, register_gpio_show, unregister_gpio_store),
                                               __ATTR_NULL };

static struct class gpio_actions = {
    .name = "sw_pwm",
    .owner = THIS_MODULE,
    .class_attrs = (struct class_attribute *) &class_attr_gpio,
};

// Called when pwm file is read.
static ssize_t pwm_show(struct class *cls, struct class_attribute *attr, char *buf)
{
    int i;
    int return_value = 0;
    
    for(i = 0; i < MAX_SW_PWMS; ++i){
        if(strcmp(pwm_value[i].name, attr->attr.name) == 0){
            return_value += sprintf(buf + return_value, "%d\tname: %s\tgpio: %d\tpwm: %d\n", i, attr->attr.name, pwm_value[i].gpio, pwm_value[i].pwm_setting);
        }
    }

    return return_value;
}

// Called when pwm directory is written to.
static ssize_t pwm_store(struct class *cls, struct class_attribute *attr, const char *buf, size_t count)
{
    int i, pwm;

    //printk(KERN_INFO "pwm_store: %s\n", attr->attr.name);
    sscanf(buf, "%du", &pwm);
    for(i = 0; i < MAX_SW_PWMS; ++i){
        if(strcmp(pwm_value[i].name, attr->attr.name) == 0){
            pwm_value[i].pwm_setting = pwm;
        }
    }
    return count;
}


static int __init gpio_pwm_init(void)
{
    int status;
    int i;
    printk(KERN_INFO "gpio_pwm_init\n");


    status = class_register(&gpio_actions);
    if (status < 0){
        printk("Registering Class Failed\n");
    }

    // Initialise data;
    for(i = 0; i < MAX_SW_PWMS; ++i){
        if(pwm_value[i].gpio >= 0){
            pwm_value[i].gpio = -1;
        }
    }

    if(!wq){
        wq = create_singlethread_workqueue("mykmod");
    }
    if(wq){
        queue_work(wq, &mykmod_work);
    }

    return 0;

}
module_init(gpio_pwm_init);


static void __exit gpio_pwm_exit(void)
{
    int i;

    printk(KERN_INFO "gpio_pwm_exit\n");
    
    running = 0;

    if(wq){
        destroy_workqueue(wq);
    }

    for(i = 0; i < MAX_SW_PWMS; ++i){
        if(pwm_value[i].gpio >= 0){
            gpio_set_value(pwm_value[i].gpio, 0);   // Turn off GPIO pin.
            pwm_value[i].gpio = -1;
            class_remove_file(&gpio_actions, &(pwm_value[i].class_attr_pwm));
        }
    }
    class_unregister(&gpio_actions);
}
module_exit(gpio_pwm_exit);

MODULE_AUTHOR("mrdunk@gmail.com");
MODULE_DESCRIPTION("PWM output using GPIO");
MODULE_LICENSE("GPL");
MODULE_ALIAS("platform:gpio_pwm");
