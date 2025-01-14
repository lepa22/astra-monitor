/*!
 * Copyright (C) 2023 Lju
 *
 * This file is part of Astra Monitor extension for GNOME Shell.
 * [https://github.com/AstraExt/astra-monitor]
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import GLib from 'gi://GLib';

import Utils from './utils/utils.js';
import CancellableTaskManager from './utils/cancellableTaskManager.js';

type Task = {
    key: string;
    task: CancellableTaskManager<boolean>;
    run: (...params: any[]) => Promise<boolean>;
    callback: (value: any) => void;
};

export default class Monitor {
    private name: string;
    
    private timerID: number|null = null;
    private listeners: Map<string, {callback:(value: any) => void, subject:any}[]> = new Map();
    private usageHistory: Map<string, any[]> = new Map();
    private enqueuedUpdates: string[] = [];
    private nextCallTime = -1;
    
    //TODO: make this configurable (and move it into a function)
    protected usageHistoryLength = 200; // 200 * 1.5 seconds = 5 minutes
    
    constructor(name: string) {
        this.name = name;
    }
    
    get updateFrequency(): number {
        Utils.log('UPDATE FREQUENCY MUST BE OVERWRITTEN');
        return -1;
    }
    
    get dueIn(): number {
        if(this.nextCallTime === -1)
            return -1;
        const dueInMicroseconds = this.nextCallTime - GLib.get_monotonic_time();
        return dueInMicroseconds / 1000;
    }
    
    get historyLength(): number {
        return this.usageHistoryLength;
    }
    
    start() {
        const updateFrequency = this.updateFrequency;
        if(this.timerID === null) {
            if(updateFrequency >= 0.1) {
                this.nextCallTime = GLib.get_monotonic_time() + (updateFrequency * 1000000);
                this.timerID = GLib.timeout_add(
                    GLib.PRIORITY_DEFAULT,
                    updateFrequency * 1000,
                    () => {
                        const res = this.update();
                        this.nextCallTime = GLib.get_monotonic_time() + (updateFrequency * 1000000);
                        return res;
                    }
                );
            }
        }
    }
    
    stop() {
        if(this.timerID) {
            GLib.source_remove(this.timerID);
            this.timerID = null;
            this.nextCallTime = -1;
        }
        this.resetData();
    }
    
    resetData() {
        this.usageHistory = new Map();
        this.enqueuedUpdates = [];
    }
    
    restart() {
        this.stop();
        this.start();
    }
    
    startListeningFor(_key: string) {
        
    }
    
    stopListeningFor(_key: string) {
        
    }
    
    update(): boolean {
        Utils.log('UPDATE MUST BE OVERWRITTEN');
        return true;
    }
    
    runTask({ key, task, run, callback }: Task) {
        task.run(run)
            .then(callback)
            .catch(e => {
                if(e.isCancelled) {
                    //TODO: manage canceled update
                    Utils.log(this.name + ' update canceled: ' + key);
                }
                else {
                    Utils.error(e.message);
                }
            });
    }
    
    pushUsageHistory(key: string, value: any) {
        let values = this.usageHistory.get(key);
        if(values === undefined) {
            values = [];
            this.usageHistory.set(key, values);
        }
        
        if(this.enqueuedUpdates.includes(key) && values.length > 0) {
            values[0] = value;
            this.enqueuedUpdates = this.enqueuedUpdates.filter(k => k !== key);
        }
        else {
            values.unshift(value);
            if(values.length > this.usageHistoryLength)
                values.pop();
        }
    }
    
    setUsageValue(key: string, value: any) {
        this.usageHistory.set(key, [value]);
    }
    
    getUsageHistory(key: string): any[] {
        const values = this.usageHistory.get(key);
        if(values === undefined)
            return [];
        return values;
    }
    
    getCurrentValue(key: string): any|null {
        const values = this.usageHistory.get(key);
        if(values === undefined)
            return null;
        return values[0];
    }
    
    resetUsageHistory(key: string) {
        this.usageHistory.set(key, []);
    }
    
    /**
     * Temporarily enqueuing the key to be overwritten by the next update to avoid falsing graphs
     * WARNING: When overriden, super.requestUpdate(key) must be called at the end of the function
     */
    requestUpdate(key: string) {
        if(!this.enqueuedUpdates.includes(key))
            this.enqueuedUpdates.push(key);
    }
    
    isListeningFor(key: string): boolean {
        const listeners = this.listeners.get(key);
        if(!listeners)
            return false;
        return listeners.length > 0;
    }
    
    listen(subject: any, key: string, callback: (value: any) => void) {
        let listeners = this.listeners.get(key);
        if(listeners === undefined) {
            listeners = [];
            this.listeners.set(key, listeners);
        }
        
        //check if the subject is already listening to this key
        for(const listener of listeners) {
            if(listener.subject === subject) {
                //if so, update the callback
                listener.callback = callback;
                return;
            }
        }
        listeners.push({ callback, subject });
        this.startListeningFor(key);
    }
    
    notify(key: string, value?: any) {
        if(!Utils.ready)
            return;
        
        const listeners = this.listeners.get(key);
        if(listeners) {
            for(const listener of listeners)
                listener.callback(value);
        }
    }
    
    unlisten(subject: any, key?: string) {
        if(key === undefined) {
            for(const key in this.listeners) {
                const listeners = this.listeners.get(key);
                if(listeners) {
                    this.listeners.set(key, listeners.filter(listener => listener.subject !== subject));
                    
                    if(listeners.length === 0)
                        this.stopListeningFor(key);
                }
            }
            return;
        }
        
        const listeners = this.listeners.get(key);
        if(listeners) {
            this.listeners.set(key, listeners.filter(listener => listener.subject !== subject));
            
            if(listeners.length === 0)
                this.stopListeningFor(key);
        }
    }
    
    destroy() {
        this.stop();
        this.listeners = new Map();
    }
}