window.VMZA_DATA = (function(){
const depots=[{id:'R-1',name:'Woronicza',code:'R-7'},{id:'R-2',name:'Kleszczowa',code:'R-11'},{id:'R-3',name:'Ostrobramska',code:'R-10'},{id:'R-4',name:'Stalowa',code:'R-13'}];
const downloads=[
['R-3','59xx','https://drive.google.com/drive/folders/1SmdiAbBYqkjwepnodjBZBWd1Y9DxO6Eb?usp=sharing'],
['R-3','73xx','https://drive.google.com/drive/folders/1x9aHhgP23KAuVAaUT_8ktRD6QnQvllNl?usp=drive_link'],
['R-3','858x/9x','https://drive.google.com/drive/folders/1mBo-gT2_97FQhEbS_VjhorZR5UaX2-?usp=drive_link'],
['R-3','839x','https://drive.google.com/drive/folders/1tUcPUrWck_h9rCoJ-7muIDvxhRVqJmNh?usp=sharing'],
['R-4','14xx','https://drive.google.com/drive/u/1/folders/1VxdC2gUsIykoztNjC-epvbiC5_pFyb3c'],
['R-4','18xx','https://drive.google.com/drive/u/1/folders/1VxdC2gUsIykoztNjC-epvbiC5_pFyb3c'],
['R-4','34xx','https://drive.google.com/file/d/1Zs-NPLYVbe1AxDscITe3ZIVG2M0TqiRo/view?usp=sharing'],
['R-4','54xx','https://drive.google.com/file/d/1DLDMsrRYIhWL-bM5BrSqN9ndt2JyToWW/view'],
['R-4','59xx','https://drive.google.com/drive/folders/1SmdiAbBYqkjwepnodjBZBWd1Y9DxO6Eb?usp=sharing'],
['R-4','84xx','https://drive.google.com/file/d/1oLNbvMxtP-sGlQSKLDfdUWxgSGVo_D9j/view?usp=drive_link'],
['R-4','88xx','https://drive.google.com/drive/u/1/folders/1VxdC2gUsIykoztNjC-epvbiC5_pFyb3c'],
['R-2','22xx','https://drive.google.com/file/d/1EBhiQq0NIWL9WmG9pOi8Y4ri5Nw1AvUG/view?usp=sharing'],
['R-2','42xx','https://www.mediafire.com/file/5udn9flqp72p9es/72xx_i_42xx.zip/file'],
['R-2','45xx','https://drive.google.com/file/d/1WsVLtcSVGBJwsKUh_6LTluoph76acKQE/view'],
['R-2','52xx','https://onedrive.live.com/?id=%2Fpersonal%2F932c706ce9dd3136%2FDocuments%2FProjekty%2Fvztm%2FPojazdy%2F52XX+2.0.zip&listurl=%2Fpersonal%2F932c706ce9dd3136%2FDocuments&e=xviykX&parent=%2Fpersonal%2F932c706ce9dd3136%2FDocuments%2FProjekty%2Fvztm%2FPojazdy&redeem=aHR0cHM6Ly8xZHJ2Lm1zL3UvcyFBall4M2Vsc2NDeVRvSmdvWlNMUGRydDJuRzU2TWc_ZT14dml5a1g&ga=1'],
['R-2','62xx','https://modsfire.com/4DWtwkla21fsZ57'],
['R-2','72xx','https://www.mediafire.com/file/5udn9flqp72p9es/72xx_i_42xx.zip/file'],
['R-1','12xx','https://mega.nz/file/gIwwjQpL#bjmR8CcH9QvzP0jXaiIQaSEZBjK97bPxNEnTRBg3ZL4'],
['R-1','20xx','https://drive.google.com/drive/folders/1x9aHhgP23KAuVAaUT_8ktRD6QnQvllNl?usp=drive_link'],
['R-1','42xx','https://www.mediafire.com/file/5udn9flqp72p9es/72xx_i_42xx.zip/file'],
['R-1','83xx','https://drive.usercontent.google.com/download?id=1aY0cZQCfeit-lcsqJxTYOeQfqqz2-x-X&export=download&authuser=2&confirm=t&uuid=a5b55e4b-725b-47b5-9f81-7987da57cae2&at=AMrWOn3oht9v_NywrIp3Sb-QR0WB:1790619142389'],
['R-1','88xx + repainty','https://drive.google.com/drive/folders/1S2MxIPzzh9EDY2_a1adpxgWMAfM8k4Fi?usp=drive_link'],
["MAP", "105, 155", "https://drive.google.com/file/d/1amuaepKoXhcRJBGLt3ucSuJc0APl_2vz/view?usp=drive_link"],
["MAP", "114, 181, 409", "https://drive.google.com/drive/u/1/folders/1VxdC2gUsIykoztNjC-epvbiC5_pFyb3c"],
["MAP", "124", "https://drive.google.com/file/d/1W1v7XIi3ZLtDnkH2TjmmsPQ0ZErVWkZb/view?usp=sharing"],
["MAP", "149, 167, 320", "https://drive.google.com/file/d/1Ychl69s6TELg0mjLMRz-McojuvcuE-Gb/view?usp=drive_link"],
["MAP", "160, 256, 304, 527", "https://drive.google.com/drive/u/1/folders/1VxdC2gUsIykoztNjC-epvbiC5_pFyb3c"],
["MAP", "163, 164, 263, 264, 519, N31, N50", "https://drive.google.com/drive/folders/1zRlFqUfyTh85W0pxsk8mMX-Ejea-OY-I"],
["MAP", "194, 716", "https://drive.google.com/file/d/1vZ0gq7HiZCe66fsjiUfsbmikLmFwYi1B/view?usp=drive_link"],
["MAP", "211, N01", "https://drive.google.com/file/d/1tjLz9fn5CVny_CYqO9rmjiAeyXjcfGZT/view?usp=drive_link"],
["EXTRA", "Baza obiektów do map", "https://drive.google.com/drive/u/1/folders/1vXM1Er_aVFPMNENGC3zHej_PiM81mIQ5"],
["EXTRA", "Tablice", "https://drive.google.com/drive/u/1/folders/1vXM1Er_aVFPMNENGC3zHej_PiM81mIQ5"],
["EXTRA", "Plik do linii, brygad i rozkładów jazdy", "https://drive.google.com/file/d/12L0u4eW-P0HmXP79X_UxAjMNlknN8QJX/view?usp=drive_link"]
];
return {depots,downloads};
})();
