import {Tokenizer} from 'cs-tokenizer'

export const tokens = {
	get End() {
		return {type: 'end', value: ''};
	},
	Scheme(scheme) {
		return {type: 'scheme', value: scheme};
	},
	get SchemeSep() {
		return {type: 'scheme-sep', value: '://'};
	},
	Authority(auth) {
		return {type: 'authority', value: auth};
	},
	get PathSep() {
		return {type: 'path-sep', value: '/'};
	},
	PathSegment(segment) {
		return {type: 'path-segment', value: segment};
	},
	Fragment(fragment) {
		return {type: 'fragment', value: fragment};
	},
	get FragmentSep() {
		return {type: 'fragment-sep', value: '#'};
	},
	get QueryStringSep() {
		return {type: 'query-string-sep', value: '?'};
	},
	Param(param) {
		const temp = param.split('=');
		const paramName = temp[0] || '';
		temp.shift();
		const paramValue = temp.join('');
		return {type: 'query-param', value: param, paramName, paramValue};
	},
	get ParamSep() {
		return {type: 'query-param-sep', value: '&'};
	}
};

export function reducer(char, state, i, chars) {

	const result = [];

	if (state.skip) {
		state.skip--;
		return false;
	}

	if (state.escapeNext === true) {
		state.escapeNext = false;
		return;
	}

	if (!(state.hasScheme || state.hasPath || state.inQueryString || state.inFragment)) {
		if (char === ':' && chars[i + 1] === '/' && chars[i + 2] === '/') {
			result.push(tokens.Scheme(state.literal.join('')));
			result.push(tokens.SchemeSep);
			state.literal.length = 0;
			state.hasScheme = true;
			state.inAuthority = true;
			state.skip = 2;
		}
	} else if (state.inAuthority) {
		switch (char) {
			case '/':
			case '?':
			case '#':
			case 'end':
				result.push(tokens.Authority(state.literal.join('')));
				state.literal.length = 0;
				state.inAuthority = false;
				state.hasAuthority = true;
		}
	} else if (state.inFragment) {
		switch (char) {
			case 'end':
				result.push(tokens.Fragment(state.literal.join('')));
				state.literal.length = 0;
		}
	} else if (state.inQueryString) {
		switch (char) {
			case '&':
			case '#':
			case 'end':
				if (state.literal.length) {
					state.hasParam = true;
					result.push(tokens.Param(state.literal.join('')));
					state.literal.length = 0;
				}
		}
	} else {
		switch (char) {
			case '/':
			case '?':
			case '#':
			case 'end':
				if (state.literal.length) {
					result.push(tokens.PathSegment(state.literal.join('')));
					state.literal.length = 0;
				}
		}
	}

	switch (char) {
		case '\\':
			state.escapeNext = true;
			return false;
		case '/':
			if (!(state.inQueryString || state.inFragment)) {
				if (state.hasPath && (chars[i + 1] === '?' || chars[i + 1] === '#' || chars[i + 1] === 'end')) {
					return result.length ? result : false;
				}
				if (chars[i + 1] === '/') {
					return result.length ? result : false;
				}
				state.hasPath = true;
				if (state.literal.length) {
					result.push(tokens.PathSegment(state.literal.join('')));
					state.literal.length = 0;
				}
				result.push(tokens.PathSep);
			}
			break;
		case '?':
			if (!(state.inQueryString || state.inFragment)) {
				if (chars[i + 1] === '#' || chars[i + 1] === 'end') {
					return result;
				}
				state.inQueryString = true;
				result.push(tokens.QueryStringSep);
			}
			break;
		case '&':
			if (state.inQueryString && chars[i + 1] !== 'end') {
				if (!state.hasParam) {
					return result;
				}
				state.hasParam = false;
				result.push(tokens.ParamSep);
			}
			break;
		case '#':
			if (!state.inFragment) {
				if (chars[i + 1] === 'end') {
					return result;
				}
				state.inFragment = true;
				result.push(tokens.FragmentSep);
			}
			break;
		case 'end':
			if (state.hasAuthority && !(state.hasPath || state.inFragment || state.inQueryString)) {
				result.push(tokens.PathSep);
			}
			result.push(tokens.End);
			break;
	}
	return result.length ? result : null;
}

const tokenizer = new Tokenizer(reducer);

function tokenizerFunction(text) {

	const tokens = tokenizer.tokenize(text);

	const isQueryParamToken = (token) => token.type === 'query-param';

	const sortedParams = tokens.filter(isQueryParamToken)
		.sort((a, b) => {
			if (a.paramName > b.paramName) {
				return 1;
			}
			if (a.paramName < b.paramName) {
				return -1;
			}
			if (a.paramValue > b.paramValue) {
				return 1;
			}
			if (a.paramValue < b.paramValue) {
				return -1;
			}
			return 0;
		});

	let tokenPos = 0;

	return tokens.map((t) => {
		if (isQueryParamToken(t)) {
			return sortedParams[tokenPos++]
		}
		return t;
	});

}

Object.keys(tokens).forEach((key) => {
	tokenizerFunction[key] = tokens[key];
});

export const urlTokenizer = tokenizerFunction;
