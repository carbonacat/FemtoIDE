APP.addPlugin("Text", ["Project"], _=>{
    
    let textViewInstance = 0;
    let killRing = [];
    let yankRange;
    let highlightView = null;
    let fontSize = 16;

    class TextView {

        action(){
            if( !this.ace.isFocused() )
                return;
            this.doAction();
        }

        doAction(){
        }

        attach(){
            APP.add(this);
            APP.async(_=>this.ace.resize(true));
            this.refreshBreakpoints();
            this.ace.focus();
            if( this.buffer.data != this.ace.session ){
                this.onFileChanged(this.buffer);
            }
            if(highlightView != this)
                this.clearHighlight();
        }

        detach(){
            APP.remove(this);
        }

        onResize(){
            if(this.resizeScheduled)
                return;
            this.resizeScheduled = true;
            setTimeout(_=>{
                this.resizeScheduled = false;
                this.ace.resize(true);
            }, 200);
        }

        onCloseFrame(){
            this.onResize();
        }
        
/*
        onCommandStarted(){
            this.ace.setReadOnly(true);
        }

        onCommandEnded(){
            this.ace.setReadOnly(false);
        }
*/
        clearHighlight( buffer ){
            let session = this.ace.session, classes;
            if( buffer && buffer.data != session )
                return;
            let breakpoints = session.getBreakpoints();

            if( this.highlight !== undefined ){
                classes = (breakpoints[ this.highlight ]||"").split(" ");
                let index = classes.indexOf("highlight");
                classes.splice(index, 1);
                if( !classes.length ){
                    session.clearBreakpoint( this.highlight );
                }else{
                    session.setBreakpoint( this.highlight, classes.join(" ") );
                }
            }

            this.highlight = undefined;
        }

        highlightLine( buffer, line, jump ){
            let session = this.ace.session, classes;
            if( buffer && buffer.data != session ){
                if( this.highlight )
                    this.clearHighlight( this.buffer.data );
                return;
            }

            highlightView = this;

            this.clearHighlight( this.buffer.data );
            
            let breakpoints = session.getBreakpoints();

            this.highlight = line-1;
            classes = (breakpoints[line-1]||"").split(" ");
            classes.push("highlight");
            session.setBreakpoint( line-1, classes.join(" ") );

            if( jump )
                this.jumpToLine( this.buffer, line );
        }

        locationFromPosition(buffer, pos){
            if( buffer != this.buffer )
                return undefined;

            let lines = this.ace
                .session
                .getValue()
                .substr(0, pos)
                .split(/\n/);

            return {
                line: lines.length - 1,
                character: lines[lines.length-1].length + 1
            };
        }

        jumpToOffset(buffer, offset){
            if( buffer != this.buffer )
                return;
            let {line} = this.locationFromPosition(buffer, offset);
            this.jumpTo(buffer, line + 1, 1);
        }

        jumpTo(buffer, line, column){
            if( buffer != this.buffer )
                return;
            
            this.ace.scrollToLine(line, true, false, function () {});
            this.ace.gotoLine(line, column, false);
            setTimeout(_=>{
                this.ace.scrollToLine(line, true, false, function () {});
                this.ace.gotoLine(line, column, false);
            }, 500);
        }

        jumpToLine(buffer, line){
            if( arguments.length == 1 ){
                line = buffer;
                buffer = null;
            }

            if( buffer && buffer.data != this.ace.session )
                return;
            
            this.ace.scrollToLine(line, true, false, function () {});
            this.ace.gotoLine(line, 0, false);
            setTimeout(_=>{
                this.ace.scrollToLine(line, true, false, function () {});
                this.ace.gotoLine(line, 0, false);
            }, 500);
        }

        cut(){
            if( !this.ace.isFocused() )
                return;
            let range = this.ace.selection.getRange();
            let text = this.ace.session.getTextRange( range );
            this.ace.session.replace( range, "" );
            nw.Clipboard.get().set(text, "text");
        }

        copy(){
            if( !this.ace.isFocused() )
                return;
            let range = this.ace.selection.getRange();
            let text = this.ace.session.getTextRange( range );
            nw.Clipboard.get().set(text, "text");
        }

        paste(){
            if( !this.ace.isFocused() )
                return;
            let range = this.ace.selection.getRange();
            this.ace.selection.clearSelection();
            this.ace.session.replace(range, "");
            this.ace.session.insert(range.start, nw.Clipboard.get().get("text"));
        }

        toggleComment(){
            this.ace.execCommand("togglecomment");
        }

        jumpToDeclaration(){
            let pos = this.ace.getCursorPosition();
            pos = this.ace.session.doc.positionToIndex(pos);
            let location = APP.findDeclaration( this.buffer, pos );
            if( location ){
                let buffer = APP.findFile(location.unit, true);
                APP.jumpTo(buffer, location.startLine, location.startColumn-1);
            }
        }

        yank(){
            if( !killRing.length ) return;
            let start = this.ace.getCursorPosition();
            
            this.ace.session.insert(
                start,
                killRing[killRing.length-1]
            );

            let end = this.ace.getCursorPosition();
            yankRange = new ace.Range(
                start.row, start.column,
                end.row, end.column
            );

        }

        yankPop(){
            if( killRing.length < 2 || !yankRange ) return;
            killRing.pop();
            this.ace.session.replace( yankRange, killRing[killRing.length-1] );

            let end = this.ace.getCursorPosition();
            yankRange = new ace.Range(
                yankRange.start.row, yankRange.start.column,
                end.row, end.column
            );
        }

        killRingSave(){
            let range = this.ace.selection.getRange();
            let text = this.ace.session.getTextRange( range );
            killRing.push(text);
        }

        killRegion(){
            let range = this.ace.selection.getRange();
            let text = this.ace.session.getTextRange( range );
            this.ace.session.replace( range, "" );
            killRing.push(text);
        }

        kill(){
            this.DOM.innerHTML = "";
        }

        refreshBreakpoints(){
            let buffer = this.buffer;
            let session = this.ace.session;
            this.ignoreBPEvents = true;
            this.ace.session.clearBreakpoints();

            for( let row in buffer.pluginData.breakpoints ){
                let classes = buffer.pluginData.breakpoints[row];
                if( classes.length ){
                    session.setBreakpoint( row, classes );
                }
            }

            this.ignoreBPEvents = false;
        }

        getTextFrame(){
            return this.frame;
        }

        constructor( frame, buffer ){
            this.frame = frame;
            this.resizeScheduled = false;
            this.buffer = buffer;
            this.hash = buffer.hash;

            let id = "text_" + (textViewInstance++);
            this.DOM = DOC.create( frame, "div", {
                id,
                className: "IDE"
            });

            this.ignoreBPEvents = false;
            this.ignoreChange = false;
            this.highlight = undefined;

            this.ace = ace.edit( id );
            if(!buffer.path)
                this.ace.setReadOnly(true);
            this.ace.setTheme( DATA.aceTheme || "ace/theme/kuroir" );
            let hnd;
            let session = this.ace.session;
            
            session.setUndoManager( new ace.UndoManager() );
            session.on("change", _=>{
                if( this.ignoreChange )
                    return;

                buffer.modified = true;
                if( hnd ) clearTimeout( hnd );
                hnd = setTimeout( save, 1000 );
                function save(){
                    hnd = 0;
                    if( buffer.modified )
                        APP.writeBuffer( buffer );
                }
            });
            
            this.ace.onPaste = function() { return ""; };
	    this.ace.on("guttermousedown", e => {
                if( this.ignoreBPEvents )
                    return;
                
	        let target = e.domEvent.target; 
	        if (target.className.indexOf("ace_gutter-cell") == -1) 
		    return; 

	        e.stop();
                let row = e.getDocumentPosition().row;
                let breakpoints = session.getBreakpoints();
                let classes = (breakpoints[row] || "").split(" ");
                let index = classes.indexOf("unconditional");
                let isSet = index == -1;
                if( isSet )
                    classes.push("unconditional");
                else
                    classes.splice(index, 1);
                
                if( classes.length ){
                    session.setBreakpoint( row, classes.join(" ") );
                    breakpoints[row] = classes.join(" ");
                }else{
                    session.clearBreakpoint( row );
                    delete breakpoints[row];
                }

                buffer.pluginData.breakpoints = breakpoints;

                if( isSet )
                    APP.onAddBreakpoint(buffer, row);
                else
                    APP.onRemoveBreakpoint(buffer, row);
	    });

            this.applyFontSizeChange();
            APP.onCreateACE( this.ace );
            
            buffer.transform = "transformSessionToString";
            
            if( typeof buffer.data == "string" ){
                this._setValue(buffer.data);
                buffer.data = session;            
            }else{
                buffer.data = session;            
                APP.readBuffer( buffer, "utf-8", (err, data) => {
                    buffer.data = session;
                    this._setValue( data || "" );
                }, true);
            }

        }

        onBeforeWriteBuffer( buffer ){
            if( buffer == this.buffer ){
                this.hash = buffer.hash;
            }
        }

        onFileChanged( buffer ){
            if( buffer != this.buffer )
                return;

            if(buffer.data && buffer.data != this.ace.session && buffer.data.constructor == this.ace.session.constructor){
                this._setValue(buffer.data.getValue());
                return;
            }

            if(!buffer.path){
                this._setValue( buffer.data || "" );
                return;
            }

            APP.readBuffer( buffer, "utf-8", (err, data) => {
                buffer.data = this.ace.session;                
                if( this.hash != buffer.hash ){
                    this.hash = buffer.hash;
                    this._setValue( data || "" );
                }
            }, true);            
        }

        onAfterWriteBuffer( buffer ){
            if( buffer != this.buffer || buffer.data == this.ace.session )
                return;
            this._setValue(buffer.data || "");
            buffer.data = this.ace.session;
        }

        _setValue(value){
            if(this.ace.session.getValue() == value)
                return;
            this.ignoreChange = true;
            this.ace.session.setValue( value );
            this.ignoreChange = false;
        }

        applyFontSizeChange(){
            this.ace.setFontSize(fontSize);
        }

    };

    APP.add({

        increaseFontSize(amount = 2){
            fontSize += Math.abs(amount);
            APP.applyFontSizeChange();
        },

        decreaseFontSize(amount = 2){
            fontSize -= Math.abs(amount);
            if(fontSize < 6) fontSize = 6;
            APP.applyFontSizeChange();
        },

        transformSessionToString( session ){
            if( !session || !session.getValue )
                return session;
            return session.getValue();
        },
        
        pollViewForBuffer( buffer, vf ){
            
            if( vf.priority < 0 ){
                vf.view = TextView;
                vf.priority = 0;
            }
            
        }
        
    });

    return TextView;

});
