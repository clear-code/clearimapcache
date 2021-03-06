/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

const ID = 'clearimapcache@clear-code.com';

const Cc = Components.classes;
const Ci = Components.interfaces;
Components.utils.import('resource://gre/modules/XPCOMUtils.jsm');

const kCID  = Components.ID('{1e2fc340-a29f-11de-8a39-0800200c9a66}');
const kID   = '@clear-code.com/clearimapcache/startup;1';
const kNAME = 'ClearIMAPLocalCacheService';

const ObserverService = Cc['@mozilla.org/observer-service;1']
		.getService(Ci.nsIObserverService);

const DirectoryService = Cc['@mozilla.org/file/directory_service;1']
		.getService(Ci.nsIProperties);

function ClearimapcacheStartupService() {
}
ClearimapcacheStartupService.prototype = {

	observe : function(aSubject, aTopic, aData)
	{
		switch (aTopic)
		{
			case 'app-startup':
				ObserverService.addObserver(this, 'profile-after-change', false);
				return;

			case 'profile-after-change':
				try {
					ObserverService.removeObserver(this, 'profile-after-change');
				}
				catch(e) {
					// fails on Gecko 2.0 or later
				}
				ObserverService.addObserver(this, 'quit-application', false);
				ObserverService.addObserver(this, 'xpcom-will-shutdown', false);
				this.clearAll();
				return;

			case 'quit-application':
				ObserverService.removeObserver(this, 'quit-application');
				// cahce profile data for post process
				this.shouldClearSummary = this.getPref('extensions.clearimapcache.clear.summary');
				this.getIMAPMailFolder();
				if (this.getPref('extensions.clearimapcache.enabled'))
					this.clearCache();
				return;

			case 'xpcom-will-shutdown':
				ObserverService.removeObserver(this, 'xpcom-will-shutdown');
				if (this.getPref('extensions.clearimapcache.enabled'))
					this.clearIMAPMails();
				return;
		}
	},

	clearAll : function()
	{
		this.clearIMAPMails();
		this.clearCache();
	},

	clearIMAPMails : function()
	{
		var IMAPMail = this.getIMAPMailFolder();
		if (IMAPMail && IMAPMail.exists())
			this.clearFilesIn(IMAPMail);
	},
	getIMAPMailFolder : function()
	{
		try {
			var folder = this.getIMAPMailFolderInternal();
			if (folder)
				this._IMAPMailFolder = folder;
		}
		catch(e) {
		}
		return this._IMAPMailFolder;
	},
	getIMAPMailFolderInternal : function()
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
					folder = DirectoryService
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

		return folder;
	},

	clearFilesIn : function(aFolder)
	{
		var children = aFolder.directoryEntries;
		while (children.hasMoreElements())
		{
			let file = children.getNext().QueryInterface(Ci.nsILocalFile);
			if (file.isDirectory()) {
				this.clearFilesIn(file);
				if (/\.sbd$/i.test(file.leafName) &&
					!file.directoryEntries.hasMoreElements())
					this.clearFile(file);
			}
			else {
				if (
					/^msgFilterRules\.dat$/i.test(file.leafName) ||
					(
						/\.msf$/i.test(file.leafName) &&
						!this.shouldClearSummary
					)
					)
					continue;
				this.clearFile(file);
			}
		}
	},
	clearFile : function(aFile)
	{
		try {
			aFile.remove(true);
		}
		catch(e) {
			dump('cannot clear ' + aFile.path + '\n');
			dump(e + '\n');
		}
	},

	clearCache : function()
	{

		try {
			var CacheStorageService = Cc['@mozilla.org/netwerk/cache-storage-service;1']
										.getService(Ci.nsICacheStorageService);
			CacheStorageService.clear();
		}
		catch(e) {
			dump(e + '\n');
			// for Thunderbird 24 or olders
			var CacheService = Cc['@mozilla.org/network/cache-service;1']
								.getService(Ci.nsICacheService);
			try {
				CacheService.evictEntries(Ci.nsICache.STORE_ANYWHERE);
			}
			catch(e) {
				dump(e + '\n');
			}
		}
	},

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

if (XPCOMUtils.generateNSGetFactory) // Gecko 2.0 or later
	var NSGetFactory = XPCOMUtils.generateNSGetFactory([ClearimapcacheStartupService]);
else // Gecko 1.9.x
	var NSGetModule = XPCOMUtils.generateNSGetModule([ClearimapcacheStartupService]);
