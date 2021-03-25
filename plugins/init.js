if(!window.headless)
(function(){

let buffer = new Buffer();
buffer.name = "Welcome";

APP.add({
/*
    queryMenus(){
        APP.addMenu("File", {
            "Open Project":"openProject"
        });
    },
*/

    openProject(...args){
        if( !args.length )
            APP.displayBuffer( buffer );
    },

    pollViewForBuffer( buffer, vf ){

        if( buffer.name == "Welcome" ){
            vf.view = ProjectsListView;
            vf.priority = 999;
        }

    }

});

class ProjectsListView {

    constructor( frame, buffer ){
        this.css = "blocking InitView";

        let projectsList;

        try{
            projectsList = fs
                .readdirSync(DATA.projectsPath)
                .filter( item => {
                    try{
                        return fs
                            .statSync(DATA.projectsPath + path.sep + item)
                            .isDirectory();
                    }catch(ex){
                        return false;
                    }
                });
        }catch(ex){
            projectsList = [];
        }

        const filterProject=( str )=>{
            str += "";
            str=str.toLowerCase();
            document.querySelectorAll(".InitView .initProjectList li .name").forEach(element => {

                let name = element.innerHTML.toLowerCase();
                let visible = true;
                if( str != "" ){
                    let i=-1;
                    for( let j=0; j<str.length; ++j ){
                        let c = str[j];
                        i = name.indexOf(c, i+1);
                        if( i ==-1 ){
                            visible = false;
                            break;
                        }
                    }
                }
                //alert(element.parentNode.classList);

                if( visible ) element.parentNode.style.display='flex';
                else element.parentNode.style.display='none';

            });
        };

        DOC.create(
            frame,
            "header",
            [
                [ "img",
                  {src:"images/femto-icon2.svg"}
                ],
                [ "div",{
                    html:"<h1>Welcome to FemtoIDE</h1>",
                    className:"textContainer"
                }]
            ]
        );

        DOC.create(
            frame,
            "div", {className:"projectBtnContainer"},
            [
                [ "div",
                  {text:"Projects"}
                ],
                [ "div",{
                    text:"New Project",
                    className:"newProjectBtn",
                    onclick: _=>APP.newProject()
                }]
            ]
        );

        DOC.create( frame,
            "div", {className:"searchContainer"},
            [
                [ "input", {
                    className:"search",
                    placeholder:"Filter Projects",
                    onkeyup: e=> filterProject(e.target.value)}
                ]
            ]
        );

        DOC.create(
            frame,
            "ul",
            {className:"initProjectList"},
            [
                ...projectsList.map( (project) => {
                    let icon="images/icons/cpp.svg";
                    let folderTime=Date.now();
                    try {
                        folderTime = fs.statSync(DATA.projectsPath + path.sep + project).mtime;
                        const prinfo=require(DATA.projectsPath + path.sep + project+ path.sep+"project.json");

                        if(prinfo.pipelines.Pokitto.find(element => element == "compile-java"))
                            icon="images/icons/java.svg";
                        if(prinfo.LDFlags.Pokitto.find(element => element.search("libmicropython.a")>0))
                            icon="images/icons/python.svg";

                    } catch (error) {

                    }

                    return [
                        "li",
                        {
                            html: `<img src="${icon}"><div class="name">${project}</div> <span>${folderTime.toLocaleString()}</span>`,
                            onclick: _=>APP.openProject(DATA.projectsPath + path.sep + project)
                        }];

                })

            ]
        );

        if( localStorage.getItem("lastProject") ){
            DOC.create(
                frame,
                "div",
                {text:"Last Project", className:"lastProjectContainer"},
                [
                [ "div",
                    {text: localStorage.getItem("lastProject").split(path.sep).pop(),
                    title: localStorage.getItem("lastProject"),
                    className:"lastProjectLink",
                    onclick:()=>{APP.openProject(localStorage.getItem("lastProject"))}}
                ]
                ]
            );
        }
    }

}

APP.displayBuffer( buffer );

})();
