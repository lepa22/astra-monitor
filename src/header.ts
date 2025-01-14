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
import St from 'gi://St';
import Atk from 'gi://Atk';
import Clutter from 'gi://Clutter';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import Utils from './utils/utils.js';
import Config from './config.js';
import MenuBase from './menu.js';

declare const global: any;

export default GObject.registerClass(
class Header extends St.Widget {
    private box: St.BoxLayout;
    private menu?: MenuBase;
    
    constructor(name: string) {
        super({
            reactive: true,
            can_focus: true,
            track_hover: true,
            style_class: 'panel-button astra-monitor-header',
            accessible_name: name,
            accessible_role: Atk.Role.MENU,
            x_expand: true,
            y_expand: true,
            y_align: Clutter.ActorAlign.CENTER,
        });
        this.name = name;
        
        const hbox = new St.BoxLayout({ style_class: 'astra-monitor-header-box' });
        this.add_child(hbox);
        this.box = hbox;
        
        this.createTooltip();
        
        this.connect('button-press-event', (_widget, _event) => {
            if(this.menu)
                this.menu.toggle();
            return Clutter.EVENT_PROPAGATE;
        });
        
        this.connect('touch-event', (_widget, _event) => {
            if(this.menu)
                this.menu.toggle();
            return Clutter.EVENT_PROPAGATE;
        });
        
        this.connect('hide', () => {
            if(this.menu)
                this.menu.close(true);
        });
        
        this.connect('enter-event', () => {
            this.showTooltip();
        });
        
        this.connect('leave-event', () => {
            this.hideTooltip();
        });
        
        Config.connect(this, 'changed::headers-height', this.setStyle.bind(this));
        Config.connect(this, 'changed::headers-margins', this.setStyle.bind(this));
        this.setStyle();
    }
    
    public getMenu() {
        return this.menu;
    }
    
    // @ts-expect-error vfunc not in types
    vfunc_get_preferred_width(_forHeight): [number, number] {
        const child = this.get_first_child();
        if(child) 
            return child.get_preferred_width(_forHeight);
        return [0, 0];
    }
    
    // @ts-expect-error vfunc not in types
    vfunc_get_preferred_height(_forWidth): [number, number] {
        const child = this.get_first_child();
        if(child)
            return child.get_preferred_height(_forWidth);
        return [0, 0];
    }
    
    setStyle() {
        let style = '';
        
        let margins = Config.get_int('headers-margins');
        if(margins < 0 || margins > 15)
            margins = 4;
        if(margins > 0)
            style += `margin-top:${margins}px;margin-bottom:${margins}px;`;
        
        let height = Config.get_int('headers-height');
        if(height < 15 || height > 80)
            height = 32;
        style += `height:${height}px;`;
        
        this.box.set_style(style);
        //this.box.height = height;
        this.box.queue_relayout();
    }
    
    add_child(child: any) {
        if(this.box)
            this.box.add_child(child);
        else
            super.add_child(child);
    }
    
    insert_child_above(child: any, sibling: any) {
        if(this.box)
            this.box.insert_child_above(child, sibling);
        else
            super.insert_child_above(child, sibling);
    }
    
    insert_child_at_index(child: any, index: number) {
        if(this.box)
            this.box.insert_child_at_index(child, index);
        else
            super.insert_child_at_index(child, index);
    }
    
    insert_child_below(child: any, sibling: any) {
        if(this.box)
            this.box.insert_child_below(child, sibling);
        else
            super.insert_child_below(child, sibling);
    }
    
    remove_child(child: any) {
        if(this.box)
            this.box.remove_child(child);
        else
            super.remove_child(child);
    }
    
    update() {
        // Implement this method in subclasses
        Utils.error('update() needs to be overridden');
    }
    
    setMenu(menu: MenuBase) {
        this.menu = menu;
        // @ts-expect-error connect not updated in types
        this.menu.connect('open-state-changed', this.onOpenMenu.bind(this));
    }
    
    /**!
     * FUNCTION FROM TOPHAT: https://github.com/fflewddur/tophat
     * Not really working no my end, it needs a deeper look
     * Right now it's not a priority, menus are very short
     * Keep it here for future reference
     */
    onOpenMenu(_menu: any, open: boolean) {
        if(open) {
            this.add_style_pseudo_class('active');
            
            if(this.menu)
                this.menu.onOpen();
        }
        else {
            this.remove_style_pseudo_class('active');
            
            if(this.menu)
                this.menu.onClose();
        }
        
        // Setting the max-height won't do any good if the minimum height of the
        // menu is higher then the screen; it's useful if part of the menu is
        // scrollable so the minimum height is smaller than the natural height
        const workArea = Main.layoutManager.getWorkAreaForMonitor(Main.layoutManager.primaryIndex);
        const scaleFactor = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        // @ts-expect-error actor not in types
        const verticalMargins = this.menu.actor.margin_top + this.menu.actor.margin_bottom;
        
        // The workarea and margin dimensions are in physical pixels, but CSS
        // measures are in logical pixels, so make sure to consider the scale
        // factor when computing max-height
        // @ts-expect-error getWorkAreaForMonitor not updated
        const maxHeight = Math.round((workArea.height - verticalMargins) / scaleFactor);
        // @ts-expect-error actor not in types
        this.menu.actor.style = `max-height: ${maxHeight}px;`;
    }
    
    createTooltip() {
        
    }
    
    showTooltip() {
        
    }
    
    hideTooltip() {
        
    }
    
    destroy() {
        Config.clear(this);
        
        if(this.menu) {
            this.menu.onClose();
            this.menu.destroy();
        }
        
        super.destroy();
    }
});
