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

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import St from 'gi://St';
import Cairo from 'gi://cairo';

import {gettext as _, ngettext} from 'resource:///org/gnome/shell/extensions/extension.js';

import GraphBase, { CairoContext, GraphProps } from '../graph.js';
import Config from '../config.js';
import Utils, { Color } from '../utils/utils.js';
import { StorageIO } from './storageMonitor.js';

// eslint-disable-next-line @typescript-eslint/ban-types
type StorageGraphProps = GraphProps & {
    
};

export default GObject.registerClass(
class StorageGraph extends GraphBase<StorageIO> {
    private colors!: Color[];
    private bgColor!: Color;
    private midLineColor!: Color;
    
    private maxReadSpeedLabel?: St.Label;
    private maxWriteSpeedLabel?: St.Label;
    
    constructor(params: StorageGraphProps) {
        super(params);
    }
    
    setStyle() {
        this.colors = [
            Utils.parseRGBA('rgb(29,172,214)'),
            Utils.parseRGBA('rgb(214,29,29)')
        ];
        
        let line = 'rgba(255,255,255,0.2)';
        if(Utils.themeStyle === 'light') {
            if(this.mini)
                line = 'rgba(0,0,0,0.8)';
            else
                line = 'rgba(0,0,0,1.0)';
        }
        this.midLineColor = Utils.parseRGBA(line);
        
        let bg = 'rgba(0,0,0,0.2)';
        if(Utils.themeStyle === 'light')
            bg = 'rgba(255,255,255,0.2)';
        this.bgColor = Utils.parseRGBA(bg);
    }
    
    buildHistoryGrid() {
        if(!this.historyGrid)
            return;
        
        this.maxReadSpeedLabel = new St.Label({
            text: '-',
            y_align: Clutter.ActorAlign.START,
            style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(this.maxReadSpeedLabel, 2, 0, 1, 1);
        this.maxWriteSpeedLabel = new St.Label({
            text: '',
            y_align: Clutter.ActorAlign.CENTER,
            style_class: 'astra-monitor-graph-label',
            style: 'margin-top:10px;'
        });
        this.historyGrid.attach(this.maxWriteSpeedLabel, 2, 1, 1, 1);
        let label = new St.Label({text: '', y_align: Clutter.ActorAlign.END, style_class: 'astra-monitor-graph-label'});
        this.historyGrid.attach(label, 2, 2, 1, 1);
        
        const seconds = Utils.memoryMonitor.historyLength * Config.get_double('memory-update');
        const limitInMins = seconds / 60;
        const startLabel = (ngettext('%d min ago', '%d mins ago', limitInMins) as any).format(limitInMins);
        label = new St.Label({text: startLabel, style_class: 'astra-monitor-graph-label-then'});
        this.historyGrid.attach(label, 0, 3, 1, 1);
        label = new St.Label({text: _('now'), style_class: 'astra-monitor-graph-label-now'});
        this.historyGrid.attach(label, 1, 3, 1, 1);
        
        Config.connect(this, 'changed::storage-io-unit', () => {
            if(!this.history)
                return;
            
            const slicedHistory = this.history.slice(0, this.historyLimit);
            const maxRead = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesReadPerSec), 0), 1024 * 1024);
            const maxWrite = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesWrittenPerSec), 0), 1024 * 1024);
            this.refreshMaxSpeed(maxRead, maxWrite);
        });
    }
    
    refreshMaxSpeed(maxRead: number, maxWrite: number) {
        const unit = Config.get_string('storage-io-unit');
            
        if(this.maxReadSpeedLabel)
            this.maxReadSpeedLabel.text = Utils.formatBytesPerSec(maxRead, unit as any, 2);

        if(this.maxWriteSpeedLabel)
            this.maxWriteSpeedLabel.text = Utils.formatBytesPerSec(maxWrite, unit as any, 2);
    }
    
    repaint() {
        const [width, height] = this.historyChart.get_surface_size();
        const ctx: CairoContext = this.historyChart.get_context();
        
        this.setupClipping(ctx, width, height, 2);
        
        ctx.setSourceRGBA(this.bgColor.red, this.bgColor.green, this.bgColor.blue, this.bgColor.alpha);
        ctx.rectangle(0, 0, width, height);
        ctx.fill();
        
        if(this.history && this.history.length > 0) {
            const pointSpacing = width / (this.historyLimit - 1);
            
            const slicedHistory = this.history.slice(0, this.historyLimit);
            const baseX = (this.historyLimit - slicedHistory.length) * pointSpacing;
            
            const maxRead = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesReadPerSec), 0), 1024 * 1024);
            const maxWrite = Math.max(slicedHistory.reduce((max, d) => Math.max(max, d.bytesWrittenPerSec), 0), 1024 * 1024);
            
            this.refreshMaxSpeed(maxRead, maxWrite);
            
            ctx.setSourceRGBA(this.colors[0].red, this.colors[0].green, this.colors[0].blue, this.colors[0].alpha);
            const readFunc = (node: StorageIO) => node.bytesReadPerSec / maxRead;
            this.drawGraph(ctx, slicedHistory, readFunc, baseX, 0, height/2, pointSpacing);
            
            ctx.setSourceRGBA(this.colors[1].red, this.colors[1].green, this.colors[1].blue, this.colors[1].alpha);
            const writeFunc = (node: StorageIO) => node.bytesWrittenPerSec / maxWrite;
            this.drawGraph(ctx, slicedHistory, writeFunc, baseX, height/2, height/2, pointSpacing);
        }
        
        //draw a line at 50%
        ctx.setSourceRGBA(this.midLineColor.red, this.midLineColor.green, this.midLineColor.blue, this.midLineColor.alpha);
        
        if(this.mini) {
            ctx.moveTo(0, height/2);
            ctx.setLineCap (Cairo.LineCap.ROUND);
            ctx.setLineWidth(0.5);
            ctx.lineTo(width, height/2);
            ctx.stroke();
        }
        else {
            ctx.rectangle(0, height/2, width, 1);
            ctx.fill();
        }
        
        ctx.$dispose();
    }
});