const ID = 'clearimapcache@clear-code.com';

const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

const kCID  = Components.ID('{1e2fc340-a29f-11de-8a39-0800200c9a66}'); 
const kID   = '@clear-code.com/clearimapcache/startup;1';
const kNAME = "Clear IMAP Local Cache Service";

const ObserverService = Cc['@mozilla.org/observer-service;1']
		.getService(Ci.nsIObserverService);

function clearimapcacheStartupService() { 
}
clearimapcacheStartupService.prototype = {
	 
	observe : function(aSubject, aTopic, aData) 
	{
		switch (aTopic)
		{
			case 'app-startup':
				ObserverService.addObserver(this, 'profile-after-change', false);
				return;

			case 'profile-after-change':
				ObserverService.removeObserver(this, 'profile-after-change');
				if (this.getPref('extensions.clearimapcache.enabled') !== false)
					this.clear();
				return;
		}
	},
 
	clear : function() 
	{
		var root = this.getPref('mail.root.imap');
		var folder = Cc['@mozilla.org/file/local;1']
						.createInstance(Ci.nsILocalFile);
		try {
			folder.initWithPath(root);
			if (!folder.exists())
				folder = null;
		}
		catch(e) {
			folder = null;
		}

		if (!folder) {
			try {
				root = this.getPref('mail.root.imap-rel');
				var keyword;
				root = root.replace(/^\[[^\]]+\]/, function(aKeyword) {
					keyword = aKeyword.substring(1, aKeyword.length-1);
					return '';
				});
				if (keyword) {
					folder = Cc['@mozilla.org/file/directory_service;1']
							.getService(Ci.nsIProperties)
							.get(keyword, Ci.nsIFile)
							.QueryInterface(Ci.nsILocalFile);
					folder.appendRelativePath(root);
					if (!folder.exists())
						folder = null;
				}
				else {
					folder = null;
				}
			}
			catch(e) {
				folder = null;
			}
		}

		if (!folder) return;

		this.clearFilesIn(folder);
	},

	clearFilesIn : function(aFolder)
	{
		var children = aFolder.directoryEntries;
		var shouldRemove = [];
		while (children.hasMoreElements())
		{
			let file = children.getNext().QueryInterface(Ci.nsILocalFile);
			if (file.isDirectory()) {
				this.clearFilesIn(file);
			}
			else {
				if (this.exceptions.test(file.leafName))
					continue;
				shouldRemove.push(file);
			}
		}
		shouldRemove.forEach(function(aFile) {
			aFile.remove(true);
		});
	},

	exceptions : /(?:^msgFilterRules.dat$|\.msf$)/i,

	Prefs : Cc['@mozilla.org/preferences;1']
				.getService(Ci.nsIPrefBranch)
				.QueryInterface(Ci.nsIPrefBranch2),
	getPref : function(aPrefstring) 
	{
		switch (this.Prefs.getPrefType(aPrefstring))
		{
			case this.Prefs.PREF_STRING:
				return decodeURIComponent(escape(this.Prefs.getCharPref(aPrefstring)));

			case this.Prefs.PREF_INT:
				return this.Prefs.getIntPref(aPrefstring);

			case this.Prefs.PREF_BOOL:
				return this.Prefs.getBoolPref(aPrefstring);

			case this.Prefs.PREF_INVALID:
			default:
				return null;
		}
	},

	classID : kCID,
	contractID : kID,
	classDescription : kNAME,
	QueryInterface : XPCOMUtils.generateQI([Ci.nsIObserver]),
	_xpcom_categories : [
		{ category : 'app-startup', service : true }
	]
 
}; 

function NSGetModule(aCompMgr, aFileSpec)
{
	return XPCOMUtils.generateModule([clearimapcacheStartupService]);
}

