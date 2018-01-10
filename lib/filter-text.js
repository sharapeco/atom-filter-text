"use babel";

import MiniBuffer from "./mini-buffer";
import { CompositeDisposable } from "atom";

export default {

        subscriptions: null,
        historyName: "filter-text",

        activate(state) {
                this.subscriptions = new CompositeDisposable();

                this.subscriptions.add(atom.commands.add("atom-workspace", {
                        "filter-text:filter-buffer": () => this.filterBuffer(),
                        "filter-text:filter-region": () => this.filterRegion()
                }));
        },

        filterBuffer() {
                let editor = atom.workspace.getActiveTextEditor();
		if (!editor) {
			return;
		}
		let buffer = editor.getBuffer();
		let content = buffer.getText();

		let dialog = new MiniBuffer({
			historyName: this.historyName,
			labelText: "Filter buffer:",
			callback: (command) => {
				this.filterByCommand(command, content, (filtered) => {
					buffer.setText(filtered);
					editor.element.focus();
					editor.scrollToCursorPosition();
				}, (code) => {
					atom.notifications.addFatalError("Command \"" + command + "\" exited with code " + code);
				});
			}
		});
		dialog.attach();
        },

        filterRegion() {
                let editor = atom.workspace.getActiveTextEditor();
		if (!editor) {
			return;
		}
		let selections = editor.getSelections();
		var completeCount = 0;

		let dialog = new MiniBuffer({
			historyName: this.historyName,
			labelText: "Filter region:",
			callback: (command) => {
				selections.forEach((selection) => {
					this.filterByCommand(command, selection.getText(), (filtered) => {
						selection.insertText(filtered);
						completeCount++;
						if (completeCount >= selections.length) {
							editor.element.focus();
							editor.scrollToCursorPosition();
						}
					}, (code) => {
						atom.notifications.addFatalError("Command \"" + command + "\" exited with code " + code);
					});
				})
			}
		});
		dialog.attach();
        },

        /**
         * @param command: string
         * @param content: string
         * @param callback: function
         * @param errorCallback: function
         */
	filterByCommand(command, content, callback, errorCallback) {
		var args = this.parseCommandArguments(command);
		let cmd = args.shift();

		const { spawn }  = require("child_process");
		const proc = spawn(cmd, args);

		var buf = "";

		proc.stdout.on("data", (data) => {
			buf += String(data);
		});

		proc.on("exit", (code) => {
			if (code === 0) {
				callback(buf);
			} else {
				errorCallback(code);
			}
		});

		proc.stdin.setEncoding("UTF-8");
		proc.stdin.write(content);
		proc.stdin.end();
	},

	/**
	* コマンドライン引数を bash のように展開する
	* スペースやシングルクォートを含む文字列を渡したいときはシングルクォートで囲ってね
	* バックスラッシュによるエスケープはシングルクォート以外知らん
        * @param command: string
	*/
	parseCommandArguments(command) {
		var args = [];
		var quote = false;
		var partial;
                command.split(/ /).forEach((seg) => {
			if (quote === false) {
				if (/^'/.test(seg)) {
					if (/'$/.test(seg) && !/\\'$/.test(seg)) {
						args.push(seg.substring(1, seg.length - 1));
					} else {
						quote = true;
						partial = seg.substr(1).replace(/\\'/g, "'") + " ";
					}
				} else if (seg !== "") {
					args.push(seg);
				}
			} else {
				if (/'$/.test(seg) && !/\\'$/.test(seg)) {
					quote = false;
					partial += seg.substr(0, seg.length - 1).replace(/\\'/g, "'");
					args.push(partial);
				} else {
					partial += seg.replace(/\\'/g, "'") + " ";
				}
			}
		});
		if (quote) {
			throw new Error("Unterminated command arguments");
		}
		return args;
	}

};
