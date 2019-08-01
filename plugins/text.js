APP.addPlugin("Text", ["Project"], _=>{
    
    let textViewInstance = 0;
    let killRing = [];
    let yankRange;

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
            this.ace.focus();
            if( !this.buffer.data ){
                this.onFileChanged(this.buffer);
            }
        }

        detach(){
            APP.remove(this);
        }

        onResize(){
            APP.async(_=>{
                this.ace.resize(true);
            });
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
            if( buffer.data != session )
                return;

            this.clearHighlight( buffer.data );
            
            let breakpoints = session.getBreakpoints();

            this.highlight = line-1;
            classes = (breakpoints[line-1]||"").split(" ");
            classes.push("highlight");
            session.setBreakpoint( line-1, classes.join(" ") );

            if( jump )
                this.jumpToLine( buffer, line );
        }

        jumpToLine(buffer, line){
            if( buffer.data != this.ace.session )
                return;
            
            this.ace.scrollToLine(line, true, false, function () {});
            this.ace.gotoLine(line, 0, false);
            setTimeout(_=>{
                this.ace.scrollToLine(line, true, false, function () {});
                this.ace.gotoLine(line, 0, false);
            }, 500);
        }

        cut(){
            let range = this.ace.selection.getRange();
            let text = this.ace.session.getTextRange( range );
            this.ace.session.replace( range, "" );
            nw.Clipboard.get().set(text, "text");
        }

        copy(){
            let range = this.ace.selection.getRange();
            let text = this.ace.session.getTextRange( range );
            nw.Clipboard.get().set(text, "text");
        }

        paste(){
            this.ace.session.replace(
                this.ace.selection.getRange(),
                nw.Clipboard.get().get("text")
            );
        }

        toggleComment(){
            this.ace.execCommand("togglecomment");
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

        constructor( frame, buffer ){
            this.buffer = buffer;
            let id = "text_" + (textViewInstance++);
            this.DOM = DOC.create( frame, "div", {
                id,
                className: "IDE"
            });

            this.ignoreChange = false;
            this.ace = ace.edit( id );
            this.ace.setTheme( DATA.aceTheme || "ace/theme/kuroir" );
            let hnd;
            let session = this.ace.session;
            this.highlight = undefined;
            
            session.setUndoManager( new ace.UndoManager() );
            session.on("change", _=>{
                if( this.ignoreChange )
                    return;

                buffer.modified = true;
                if( hnd ) clearTimeout( hnd );
                hnd = setTimeout( save, 1000 );
                function save(){
                    hnd = 0;
                    APP.writeBuffer( buffer );
                }
            });
            
            this.ace.onPaste = function() { return ""; };
	    this.ace.on("guttermousedown", e => {
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

        onFileChanged( buffer ){
            if( buffer != this.buffer )
                return;
            APP.readBuffer( buffer, "utf-8", (err, data) => {
                buffer.data = this.ace.session;
                this._setValue( data || "" );
            }, true);            
        }

        _setValue(value){
            this.ignoreChange = true;
            this.ace.session.setValue( value );
            this.ignoreChange = false;
        }

    };

    APP.add({

        transformSessionToString( session ){
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
